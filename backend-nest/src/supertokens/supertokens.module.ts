import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { SuperTokensModule } from "supertokens-nestjs";
import Session from "supertokens-node/recipe/session";
import ThirdParty from "supertokens-node/recipe/thirdparty";
import { UserModule } from "../user/user.module";
import { UserService } from "../user/user.service";

@Module({
  imports: [
    SuperTokensModule.forRootAsync({
      imports: [ConfigModule, UserModule],
      inject: [ConfigService, UserService],
      useFactory: (configService: ConfigService, userService: UserService) => {
        const ST_CONNECTION_URI =
          configService.get<string>("ST_CONNECTION_URI");
        const APP_NAME = configService.get<string>("APP_NAME", "CourseCompass");
        const API_DOMAIN = configService.get<string>(
          "API_DOMAIN",
          "http://localhost:8080",
        );
        const WEBSITE_DOMAIN = configService.get<string>("WEBSITE_DOMAIN");
        const GOOGLE_CLIENT_ID = configService.get<string>("GOOGLE_CLIENT_ID");
        const GOOGLE_CLIENT_SECRET = configService.get<string>(
          "GOOGLE_CLIENT_SECRET",
        );
        const ST_API_KEY = configService.get<string>("ST_API_KEY");
        const NODE_ENV = configService.get<string>("NODE_ENV", "development");
        const isProduction = NODE_ENV === "production"; 

        // Checking SuperTokens env variables
        const missing: string[] = [];
        if (!ST_CONNECTION_URI) {missing.push("ST_CONNECTION_URI")};
        if (!WEBSITE_DOMAIN) {missing.push("WEBSITE_DOMAIN")};
        if (!GOOGLE_CLIENT_ID) {missing.push("GOOGLE_CLIENT_ID")};
        if (!GOOGLE_CLIENT_SECRET) {missing.push("GOOGLE_CLIENT_SECRET")};
        if (isProduction && !ST_API_KEY) {missing.push("ST_API_KEY")};

        if (missing.length > 0) {
          throw new Error(
            `Missing requried SuperTokens env variables: ${missing.join(", ")}`
          );
        }

        const connectionURI = ST_CONNECTION_URI as string;
        const websiteDomain = WEBSITE_DOMAIN as string;
        const googleClientId = GOOGLE_CLIENT_ID as string;
        const googleClientSecret = GOOGLE_CLIENT_SECRET as string;

        return {
          framework: "express",
          supertokens: {
            connectionURI: connectionURI,
            apiKey: ST_API_KEY,
          },
          appInfo: {
            appName: APP_NAME,
            apiDomain: API_DOMAIN,
            websiteDomain: websiteDomain,
            apiBasePath: "/auth",
            websiteBasePath: "/auth",
          },
          recipeList: [
            ThirdParty.init({
              signInAndUpFeature: {
                providers: [
                  {
                    config: {
                      thirdPartyId: "google",
                      clients: [
                        {
                          clientId: googleClientId,
                          clientSecret: googleClientSecret,
                          scope: ["profile", "email", "openid"],
                        },
                      ],
                    },
                  },
                ],
              },
              override: {
                functions: (originalImplementation) => ({
                  ...originalImplementation,
                  signInUp: async (input) => {
                    const response =
                      await originalImplementation.signInUp(input);
                    if (response.status === "OK") {
                      const name =
                        response.rawUserInfoFromProvider.fromUserInfoAPI?.name;
                      if (!name) {
                        throw new Error("Could not get name from provider");
                      }
                      await userService.createNewUser(
                        response.user.id,
                        response.user.emails[0],
                        name,
                      );
                    }
                    return response;
                  },
                }),
              },
            }),
            Session.init(),
          ],
        };
      },
    }),
  ],
})
export class SupertokensModule {}
