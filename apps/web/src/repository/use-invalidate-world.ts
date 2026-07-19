import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

export function useInvalidateWorld() {
  const queryClient = useQueryClient();
  return useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["world-current"] });
    void queryClient.invalidateQueries({ queryKey: ["world-tiles"] });
  }, [queryClient]);
}
