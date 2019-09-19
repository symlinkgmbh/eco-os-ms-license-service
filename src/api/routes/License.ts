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



import { AbstractRoutes, injectValidatorService } from "@symlinkde/eco-os-pk-api";
import { PkApi } from "@symlinkde/eco-os-pk-models";
import { Application, Request, Response, NextFunction } from "express";
import { LicenseController } from "../controllers";

@injectValidatorService
export class LicenseRoute extends AbstractRoutes implements PkApi.IRoute {
  private licenseController: LicenseController = new LicenseController();
  private validatorService!: PkApi.IValidator;
  private postLicensePattern: PkApi.IValidatorPattern = {
    license: "",
  };

  constructor(app: Application) {
    super(app);
    this.activate();
  }

  public activate(): void {
    this.addLicense();
    this.removeLicense();
    this.loadLicense();
    this.checkLicense();
    this.checkLicenseLight();
    this.loadLicensePublicKey();
    this.loadLicenseChecksum();
    this.loadPrivateKeyPem();
  }

  private addLicense(): void {
    this.getApp()
      .route("/licensing")
      .post((req: Request, res: Response, next: NextFunction) => {
        this.validatorService.validate(req.body, this.postLicensePattern);
        this.licenseController
          .addLicense(req)
          .then((result) => {
            res.send(result);
          })
          .catch((err) => {
            next(err);
          });
      });
  }

  private loadLicense(): void {
    this.getApp()
      .route("/licensing")
      .get((req: Request, res: Response, next: NextFunction) => {
        this.licenseController
          .loadLicense()
          .then((result) => {
            res.send(result);
          })
          .catch((err) => {
            next(err);
          });
      });
  }

  private checkLicense(): void {
    this.getApp()
      .route("/licensing/check")
      .get((req: Request, res: Response, next: NextFunction) => {
        this.licenseController
          .checkLicense()
          .then((result) => {
            res.send(result);
          })
          .catch((err) => {
            next(err);
          });
      });
  }

  private checkLicenseLight(): void {
    this.getApp()
      .route("/licensing/check/light")
      .get((req: Request, res: Response, next: NextFunction) => {
        this.licenseController
          .checkLicenseLight()
          .then((result) => {
            res.send(result);
          })
          .catch((err) => {
            next(err);
          });
      });
  }

  private removeLicense(): void {
    this.getApp()
      .route("/licensing")
      .delete((req: Request, res: Response, next: NextFunction) => {
        this.licenseController
          .deleteLicense()
          .then((result) => {
            res.send(result);
          })
          .catch((err) => {
            next(err);
          });
      });
  }

  private loadLicensePublicKey(): void {
    this.getApp()
      .route("/licensing/publickey")
      .get((req: Request, res: Response, next: NextFunction) => {
        this.licenseController
          .loadPublicKey()
          .then((result) => {
            res.send({
              publickey: result,
            });
          })
          .catch((err) => {
            next(err);
          });
      });
  }

  private loadLicenseChecksum(): void {
    this.getApp()
      .route("/licensing/load/checksum")
      .get((req: Request, res: Response, next: NextFunction) => {
        this.licenseController
          .getChecksumFromLicense()
          .then((result) => {
            res.send({
              checksum: result,
            });
          })
          .catch((err) => {
            next(err);
          });
      });
  }

  private loadPrivateKeyPem(): void {
    this.getApp()
      .route("/licensing/load/privatekey")
      .get((req: Request, res: Response, next: NextFunction) => {
        this.licenseController
          .loadPrivatKeyPem()
          .then((result) => {
            res.send({
              privatekey: result,
            });
          })
          .catch((err) => {
            next(err);
          });
      });
  }
}
