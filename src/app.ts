/** 
* Copyright 2018-2019 Symlink GmbH 
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

  public init(): Promise<Application> {
    return new Promise((resolve, reject) => {
      Promise.all([this.initLogSystem(), this.bootstrapper.signInServiceRegistry(), this.validateLicenseCertificate(), this.initLicenseLoop()])
        .then(() => {
          resolve(this.api.init());
        })
        .catch((err) => {
          Log.log(err, LogLevel.error);
          reject(err);
        });
    });
  }

  private initLogSystem(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        resolve(Log.log(`init ${Config.get("name")} ${Config.get("version")}`, LogLevel.info));
      } catch (err) {
        Log.log(err, LogLevel.error);
        reject(err);
      }
    });
  }

  private validateLicenseCertificate(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const certManager: ICertManager = licenseContainer.get<ICertManager>(LICENSE_MS_TYPES.ICertManager);
        certManager.checkIfCertificateAlreadyExists().then((result) => {
          if (!result) {
            certManager.createLicenseKeyPair().then((r) => {
              resolve();
            });
          } else {
            resolve();
          }
        });
      } catch (err) {
        Log.log(err, LogLevel.error);
        reject(err);
      }
    });
  }

  private initLicenseLoop(): Promise<void> {
    return new Promise(async (resolve, reject) => {
      const redisConfig = await this.bootstrapper.exposeRedisConfig();
      await redisContainer.bind(REDIS_TYPES.REDIS_HOST).toConstantValue(redisConfig.split(":")[0]);
      await redisContainer.bind(REDIS_TYPES.REDIS_PORT).toConstantValue(redisConfig.split(":")[1]);

      const licenseLoop: ILicenseCycle = licenseCycleContainer.get<ILicenseCycle>(LICENSECYCLE_TYPES.ILicenseCycle);
      licenseLoop.init();
      resolve();
    });
  }
}
