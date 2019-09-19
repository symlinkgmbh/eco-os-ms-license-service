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



import { ILicenseManager } from "./ILicenseManager";
import { PkStroageLicense, MsLicense } from "@symlinkde/eco-os-pk-models";
import { ICertManager } from "./ICertManager";
import { CertManager } from "./CertManager";
import { CustomRestError, apiResponseCodes } from "@symlinkde/eco-os-pk-api";
import { injectLicenseService } from "@symlinkde/eco-os-pk-storage-license";
import * as forge from "node-forge";
import { StaticShaService } from "@symlinkde/eco-os-pk-crypt";
import { injectable } from "inversify";

@injectLicenseService
@injectable()
export class LicenseManager implements ILicenseManager {
  private certManager: ICertManager;
  private licenseService!: PkStroageLicense.ILicenseService;
  private decryptedLicense!: MsLicense.ILicense;
  private encryptedLicenseHash: string;

  constructor() {
    this.certManager = new CertManager();
    this.encryptedLicenseHash = "";
  }

  public async importLicense(license: string): Promise<MsLicense.IEncryptedLicense> {
    const checkForExistingLicense = await this.licenseService.loadLicense();
    if (checkForExistingLicense !== null) {
      throw new CustomRestError(
        {
          code: apiResponseCodes.C830.code,
          message: apiResponseCodes.C830.message,
        },
        400,
      );
    }

    await this.decryptLicense(license);
    const result = await this.licenseService.addLicense({
      license,
      tagName: MsLicense.LicenseTags.license,
    });

    if (result === null) {
      throw new CustomRestError(
        {
          code: apiResponseCodes.C829.code,
          message: apiResponseCodes.C829.message,
        },
        500,
      );
    }

    return result;
  }

  public async removeLicense(): Promise<boolean> {
    return await this.licenseService.removeLicense();
  }

  public async loadDecryptedLicense(): Promise<MsLicense.ILicense> {
    const encryptedLicense = await this.licenseService.loadLicense();
    if (encryptedLicense === null) {
      throw new CustomRestError(
        {
          code: apiResponseCodes.C833.code,
          message: apiResponseCodes.C833.message,
        },
        400,
      );
    }

    if (!this.decryptedLicense || this.encryptedLicenseHash !== StaticShaService.getSha3(encryptedLicense.license)) {
      this.decryptedLicense = await this.decryptLicense(encryptedLicense.license);
      this.encryptedLicenseHash = StaticShaService.getSha3(encryptedLicense.license);
    }

    return this.decryptedLicense;
  }

  public async loadPrivateKeyPem(): Promise<string | null> {
    return this.certManager.loadPrivateKeyPem();
  }

  private async decryptLicense(license: string): Promise<MsLicense.ILicense> {
    const privateKeyPem = await this.certManager.loadPrivateKeyPem();

    if (privateKeyPem === null) {
      throw new CustomRestError(
        {
          code: apiResponseCodes.C828.code,
          message: apiResponseCodes.C828.message,
        },
        500,
      );
    }

    const privateKey: any = forge.pki.privateKeyFromPem(forge.util.decode64(privateKeyPem));

    const decryptedBase64 = forge.util.decode64(
      privateKey.decrypt(forge.util.decode64(license), "RSA-OAEP", {
        md: forge.md.sha512.create(),
      }),
    );
    return JSON.parse(decryptedBase64);
  }
}
