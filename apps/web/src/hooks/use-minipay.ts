"use client";

import { useEffect, useState } from "react";

import { getInjectedProvider, isMiniPayEnv } from "@/lib/minipay";

type MiniPayState = {
  hasProvider: boolean;
  isMiniPay: boolean;
  isReady: boolean;
};

export function useMiniPay(): MiniPayState {
  const [state, setState] = useState<MiniPayState>({
    hasProvider: false,
    isMiniPay: false,
    isReady: false,
  });

  useEffect(() => {
    const provider = getInjectedProvider();

    setState({
      hasProvider: provider != null,
      isMiniPay: isMiniPayEnv(),
      isReady: true,
    });
  }, []);

  return state;
}
