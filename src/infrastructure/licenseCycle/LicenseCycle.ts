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




import { ILicenseCycle } from "./ILicenseCycle";
import { injectable } from "inversify";
import { ILicenseCycleCheckResult } from "./ILicenseCheckResult";
import { PkRedis } from "@symlinkde/eco-os-pk-models";
import { ILicenseValidator, ILicenseValidationResult } from "../validator";
import { redisContainer, REDIS_TYPES } from "@symlinkde/eco-os-pk-redis";
import { IRedisClient } from "@symlinkde/eco-os-pk-models/lib/models/packages/pk_redis/Namespace";
import { licenseValidatorContainer } from "../validator/LicenseValidatorContainer";
import { LICENSE_VALIDATOR_TYPES } from "../validator/LicenseValidatorTypes";

@injectable()
class LicenseCylce implements ILicenseCycle {
  private licenseValidator: ILicenseValidator = licenseValidatorContainer.get<ILicenseValidator>(LICENSE_VALIDATOR_TYPES.ILicenseValidator);
  private redisClient: PkRedis.IRedisClient = redisContainer.get<IRedisClient>(REDIS_TYPES.IRedisClient);

  public init(): void {
    this.triggerLicense();
    this.licenseCheckLoop();
    return;
  }

  public triggerLicense(): void {
    this.checkLicense();
  }

  public async getLicenseState(): Promise<ILicenseCycleCheckResult> {
    return await this.redisClient.get<ILicenseCycleCheckResult>("lcl");
  }

  private licenseCheckLoop(): void {
    setInterval(async () => {
      await this.checkLicense();
    }, 300000);
  }

  private async checkLicense(): Promise<void> {
    try {
      const result: ILicenseValidationResult = await this.licenseValidator.validateLicense();
      if (result.exceededUsers > 0 || result.unlicensedServices.length > 0 || result.dateExeeded) {
        this.redisClient.set("lcl", <ILicenseCycleCheckResult>{
          isValid: false,
          timeStamp: new Date().getTime(),
          message: "Your are working against an not licensed or wrong licensed 2ndLock serivce. Please contact your system adminisrator",
          tpld: "",
        });
        return;
      }

      this.redisClient.set("lcl", <ILicenseCycleCheckResult>{
        isValid: true,
        timeStamp: new Date().getTime(),
        message: "",
        tpld: result.tpld,
      });
      return;
    } catch (err) {
      this.redisClient.set("lcl", <ILicenseCycleCheckResult>{
        isValid: false,
        timeStamp: new Date().getTime(),
        message: "Your are working against an not licensed or wrong licensed 2ndLock serivce. Please contact your system adminisrator",
        tpld: "",
      });
      return;
    }
  }
}

export { LicenseCylce };
