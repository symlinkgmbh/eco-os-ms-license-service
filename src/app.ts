/**
 * Copyright 2018-2020 Symlink GmbH
 * 
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * 
 */




import "reflect-metadata";
import Config from "config";
import { hostname } from "os";
import { serviceContainer, bootstrapperContainer, ECO_OS_PK_CORE_TYPES } from "@symlinkde/eco-os-pk-core";
import { PkCore } from "@symlinkde/eco-os-pk-models";
import { Log, LogLevel } from "@symlinkde/eco-os-pk-log";
import { Api } from "./api/Api";
import { Application } from "express";
import { ICertManager, licenseContainer, LICENSE_MS_TYPES } from "./infrastructure/license";
import { redisContainer, REDIS_TYPES } from "@symlinkde/eco-os-pk-redis";
import { ILicenseCycle, LICENSECYCLE_TYPES, licenseCycleContainer } from "./infrastructure/licenseCycle";

export class Bootstrapper {
  public static getInstance(): Bootstrapper {
    if (!Bootstrapper.instance) {
      Bootstrapper.instance = new Bootstrapper();
    }

    return Bootstrapper.instance;
  }

  private static instance: Bootstrapper;
  private bootstrapper: PkCore.IBootstrapper;
  private api: Api;

  private constructor() {
    if (!process.env.SECONDLOCK_REGISTRY_URI) {
      throw new Error("missing SECONDLOCK_REGISTRY_URI env variable");
    }

    bootstrapperContainer.bind("SECONDLOCK_REGISTRY_URI").toConstantValue(process.env.SECONDLOCK_REGISTRY_URI);
    bootstrapperContainer.bind<PkCore.IBootstrapperConfig>(ECO_OS_PK_CORE_TYPES.IBootstrapperConfig).toConstantValue(<PkCore.IBootstrapperConfig>{
      name: Config.get("name"),
      address: hostname(),
      url: `http://${hostname()}:${Config.get("server.port")}`,
      license: {
        id: Config.get("serviceId"),
      },
    });

    this.bootstrapper = bootstrapperContainer.get<PkCore.IBootstrapper>(ECO_OS_PK_CORE_TYPES.IBootstrapper);
    serviceContainer.rebind("SECONDLOCK_REGISTRY_URI").toConstantValue(process.env.SECONDLOCK_REGISTRY_URI);
    this.api = new Api();
    this.bootstrapper.unsignFromServiceRegistryOnProcessTerminate(process);
    this.bootstrapper.loadGobalErrorHandler(process);
  }

  public async init(): Promise<Application> {
    try {
      this.initLogSystem();
      await this.validateLicenseCertificate();
      await this.initLicenseLoop();
      await this.bootstrapper.signInServiceRegistry();
      return await this.api.init();
    } catch (err) {
      Log.log(err, LogLevel.error);
      process.exit(1);
      throw new Error(err);
    }
  }

  private initLogSystem(): void {
    Log.log(`init ${Config.get("name")} ${Config.get("version")}`, LogLevel.info);
    return;
  }

  private async validateLicenseCertificate(): Promise<void> {
    const certManager: ICertManager = licenseContainer.get<ICertManager>(LICENSE_MS_TYPES.ICertManager);
    const hasCert = await certManager.checkIfCertificateAlreadyExists();
    if (!hasCert) {
      try {
        await certManager.createLicenseKeyPair();
        return;
      } catch (err) {
        Log.log(err, LogLevel.error);
        process.exit(1);
      }
    }
    return;
  }

  private async initLicenseLoop(): Promise<void> {
    try {
      const redisConfig = await this.bootstrapper.exposeRedisConfig();
      redisContainer.bind(REDIS_TYPES.REDIS_HOST).toConstantValue(redisConfig.split(":")[0]);
      redisContainer.bind(REDIS_TYPES.REDIS_PORT).toConstantValue(redisConfig.split(":")[1]);
      const licenseLoop: ILicenseCycle = licenseCycleContainer.get<ILicenseCycle>(LICENSECYCLE_TYPES.ILicenseCycle);
      licenseLoop.init();
      return;
    } catch (err) {
      Log.log(err, LogLevel.error);
      process.exit(1);
    }
  }
}
