"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import ThirdParty from "supertokens-auth-react/recipe/thirdparty";
import { queryKeys } from "@/lib/query-keys";
import { initST } from "@/lib/supertokens.client";
import { getMe } from "@/lib/user";
import OAuthCallbackView from "@/views/OAuthCallbackView";

export default function OAuthCallbackController() {
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    initST();
    (async () => {
      try {
        const result = await ThirdParty.signInAndUp();
        if (result.status === "OK") {
          await ThirdParty.getStateAndOtherInfoFromStorage();
          try {
            const user = await queryClient.fetchQuery({
              queryKey: queryKeys.me,
              queryFn: getMe,
            });
            if (!user) {
              queryClient.removeQueries({ queryKey: queryKeys.me });
              router.replace("/auth?error=user");
              return;
            }
            router.replace("/search");
            return;
          } catch {
            queryClient.removeQueries({ queryKey: queryKeys.me });
            router.replace("/auth?error=user");
            return;
          }
        }
        queryClient.removeQueries({ queryKey: queryKeys.me });
        router.replace("/auth?error=oauth");
      } catch {
        queryClient.removeQueries({ queryKey: queryKeys.me });
        router.replace("/auth?error=oauth");
      }
    })().catch(() => {
      queryClient.removeQueries({ queryKey: queryKeys.me });
      router.replace("/auth?error=oauth");
    });
  }, [router, queryClient]);

  return <OAuthCallbackView />;
}
