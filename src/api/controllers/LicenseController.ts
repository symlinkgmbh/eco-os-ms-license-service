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



import { ICertManager, licenseContainer, LICENSE_MS_TYPES } from "../../infrastructure/license";
import { Request } from "express";
import { ILicenseManager } from "../../infrastructure/license/ILicenseManager";
import { MsLicense } from "@symlinkde/eco-os-pk-models";
import { ILicenseValidationResult, ILicenseValidator } from "../../infrastructure/validator";
import { ILicenseCycleCheckResult } from "../../infrastructure/licenseCycle/ILicenseCheckResult";
import { ILicenseCycle, licenseCycleContainer, LICENSECYCLE_TYPES } from "../../infrastructure/licenseCycle";
import { licenseValidatorContainer } from "../../infrastructure/validator/LicenseValidatorContainer";
import { LICENSE_VALIDATOR_TYPES } from "../../infrastructure/validator/LicenseValidatorTypes";
import { CustomRestError } from "@symlinkde/eco-os-pk-api";

export class LicenseController {
  private certManager: ICertManager = licenseContainer.get<ICertManager>(LICENSE_MS_TYPES.ICertManager);
  private licenseManager: ILicenseManager = licenseContainer.get<ILicenseManager>(LICENSE_MS_TYPES.ILicenseManager);
  private licenseValidator: ILicenseValidator = licenseValidatorContainer.get<ILicenseValidator>(LICENSE_VALIDATOR_TYPES.ILicenseValidator);
  private licenseLoop: ILicenseCycle = licenseCycleContainer.get<ILicenseCycle>(LICENSECYCLE_TYPES.ILicenseCycle);

  public async loadPublicKey(): Promise<string | null> {
    const result = await this.certManager.loadPublicKeyPem();
    if (result === null) {
      throw new CustomRestError(
        {
          code: 400,
          message: "unable to load public key",
        },
        400,
      );
    }

    return result;
  }

  public async addLicense(req: Request): Promise<MsLicense.IEncryptedLicense> {
    const license = await this.licenseManager.importLicense(req.body.license);
    await this.licenseLoop.triggerLicense();
    return license;
  }

  public async loadLicense(): Promise<MsLicense.ILicense> {
    return await this.licenseManager.loadDecryptedLicense();
  }

  public async checkLicense(): Promise<ILicenseValidationResult> {
    return await this.licenseValidator.validateLicense();
  }

  public async deleteLicense(): Promise<boolean> {
    const result = await this.licenseManager.removeLicense();
    await this.licenseLoop.triggerLicense();
    return result;
  }

  public async checkLicenseLight(): Promise<ILicenseCycleCheckResult> {
    return await this.licenseLoop.getLicenseState();
  }

  public async getChecksumFromLicense(): Promise<string> {
    return await this.licenseValidator.getChecksumFromLicense();
  }

  public async loadPrivatKeyPem(): Promise<string | null> {
    const result = await this.licenseManager.loadPrivateKeyPem();
    if (result === null) {
      throw new CustomRestError(
        {
          code: 400,
          message: "unable to load private key",
        },
        400,
      );
    }
    return result;
  }
}
