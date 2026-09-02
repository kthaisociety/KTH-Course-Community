//
// This is a wrapper for the provider. Since Next.js renders server side and Redux doesn't,
// this wrapper is needed. However, it means that everything wrapped inside this provider
// will render client side. As of now, that is basically the entire app.

// There are more advanced solutions that can adopted without any hassle later on,
// if server side rendering is needed. This wrapper could be seen as as temporary solution.
//

"use client";

import { Provider } from "react-redux";
import { store } from "@/state/store";

export default function ReduxProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Provider store={store}>{children}</Provider>;
}
