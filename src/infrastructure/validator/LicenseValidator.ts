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

import { ILicenseValidator } from "./ILicenseValidator";
import { ILicenseManager } from "../license/ILicenseManager";
import { MsLicense, MsRegistry, PkCore } from "@symlinkde/eco-os-pk-models";
import { licenseContainer, LICENSE_MS_TYPES } from "../license";
import Axios, { AxiosInstance } from "axios";
import { Log, LogLevel } from "@symlinkde/eco-os-pk-log";
import { injectUserClient } from "@symlinkde/eco-os-pk-core";
import { StaticShaService } from "@symlinkde/eco-os-pk-crypt";
import { ILicenseValidationResult } from "./ILicenseValidationResult";
import { injectable } from "inversify";

interface ILicenseCollectorEntry extends MsRegistry.IRegistryLicenseEntry {
  name: string;
}

@injectUserClient
@injectable()
export class LicenseValidator implements ILicenseValidator {
  private licenseManager: ILicenseManager;
  private client: AxiosInstance;
  private userClient!: PkCore.IEcoUserClient;

  constructor() {
    this.licenseManager = licenseContainer.get<ILicenseManager>(LICENSE_MS_TYPES.ILicenseManager);
    this.client = Axios.create({
      timeout: 5000,
    });
  }

  public async getChecksumFromLicense(): Promise<string> {
    const license: MsLicense.ILicense = await this.licenseManager.loadDecryptedLicense();
    const licenseChecksumObject = { ...license };
    delete licenseChecksumObject._id;
    return StaticShaService.getSha3(JSON.stringify(licenseChecksumObject));
  }

  public async validateLicense(): Promise<ILicenseValidationResult> {
    const license: MsLicense.ILicense = await this.licenseManager.loadDecryptedLicense();

    return <ILicenseValidationResult>{
      dateExeeded: await this.hasLicenseExeededDate(license),
      exceededUsers: await this.hasLicenseExeededUsers(license),
      unlicensedServices: await this.countServices(license),
      tpld: license.tpld,
    };
  }

  private async collectLicenseMatrixFromInfrastructure(): Promise<Array<ILicenseCollectorEntry>> {
    const licenseArray: Array<ILicenseCollectorEntry> = [];
    const services: Array<any> = await this.getServiceList();

    for (const index in services) {
      if (index) {
        try {
          const response = await this.client.get(`${services[index].url}/license`);
          if (response.status === 200) {
            await licenseArray.push(<ILicenseCollectorEntry>{
              id: response.data.id,
              name: response.data.name,
            });
          }
        } catch (err) {
          Log.log(err, LogLevel.error);
        }
      }
    }

    return licenseArray;
  }

  private async getServiceList(): Promise<Array<any>> {
    const registry = process.env.SECONDLOCK_REGISTRY_URI === undefined ? "" : process.env.SECONDLOCK_REGISTRY_URI;
    const response = await this.client.get(`${registry}/registry`);

    const services: Array<any> = [];

    for (const index in response.data) {
      if (index) {
        await services.push({
          name: response.data[index].name,
          url: response.data[index].url,
        });
      }
    }

    return services;
  }

  private async countUsers(): Promise<number> {
    const result = await this.userClient.getCountFromActivatedUsers();
    return result.data.count;
  }

  private async countServices(license: MsLicense.ILicense): Promise<Array<string>> {
    const services: Array<string> = [];

    const collectedServiceLicenses: Array<ILicenseCollectorEntry> = await this.collectLicenseMatrixFromInfrastructure();

    // tslint:disable-next-line: forin
    for (const cIndex in collectedServiceLicenses) {
      const index = license.features.findIndex((entry) => entry.id === collectedServiceLicenses[cIndex].id);
      if (index === -1) {
        await services.push(collectedServiceLicenses[cIndex].name);
      }
    }

    return services;
  }

  private hasLicenseExeededDate(license: MsLicense.ILicense): boolean {
    if (license.expirationDate > new Date()) {
      return true;
    }

    return false;
  }

  private async hasLicenseExeededUsers(license: MsLicense.ILicense): Promise<number> {
    const users = await this.countUsers();

    if (license.maxUsers < users) {
      return users - license.maxUsers;
    }

    return 0;
  }
}
