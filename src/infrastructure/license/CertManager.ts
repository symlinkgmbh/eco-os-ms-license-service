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

import { injectKeyService } from "@symlinkde/eco-os-pk-storage-license";
import { PkStroageLicense, MsLicense } from "@symlinkde/eco-os-pk-models";
import { ICertManager } from "./ICertManager";
import * as forge from "node-forge";
import { injectable } from "inversify";

@injectKeyService
@injectable()
export class CertManager implements ICertManager {
  public keyService!: PkStroageLicense.IKeyService;

  public async checkIfCertificateAlreadyExists(): Promise<boolean> {
    const result = await this.keyService.loadKeys();
    if (result === null) {
      return false;
    }

    return true;
  }

  public async createLicenseKeyPair(): Promise<void> {
    const keys = this.createKeyPair();
    await this.keyService.addKeys(keys);
  }

  public async loadKeyPair(): Promise<MsLicense.ILicenseKeyPair | null> {
    return await this.keyService.loadKeys();
  }

  public async loadPublicKeyPem(): Promise<string | null> {
    const result = await this.loadKeyPair();
    if (result === null) {
      return null;
    }

    return result.publicKey;
  }

  public async loadPrivateKeyPem(): Promise<string | null> {
    const result = await this.loadKeyPair();
    if (result === null) {
      return null;
    }

    return result.privateKey;
  }

  private createKeyPair(): MsLicense.ILicenseKeyPair {
    const keys: any = forge.pki.rsa.generateKeyPair(8192);
    return <MsLicense.ILicenseKeyPair>{
      privateKey: forge.util.encode64(forge.pki.privateKeyToPem(keys.privateKey)),
      publicKey: forge.util.encode64(forge.pki.publicKeyToPem(keys.publicKey)),
      tagName: MsLicense.LicenseTags.key,
    };
  }
}
