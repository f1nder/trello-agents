import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { LazyLog } from "@melloware/react-logviewer";
import type { AgentPod } from "../types/pods";
import type { OpenShiftPodApi } from "../services/openshiftClient";

type StreamStatus = "idle" | "connecting" | "streaming" | "error";

type UsePodLogStreamArgs = {
  pod: AgentPod | null | undefined;
  openShiftClient: OpenShiftPodApi | null;
};

const textDecoder = new TextDecoder();

export const usePodLogStream = ({
  pod,
  openShiftClient,
}: UsePodLogStreamArgs) => {
  const [status, setStatus] = useState<StreamStatus>("idle");
  const [error, setError] = useState<Error | null>(null);
  const [lineCount, setLineCount] = useState(0);
  const [follow, setFollow] = useState(true);

  const logRef = useRef<LazyLog | null>(null);
  const pendingLinesRef = useRef<string[]>([]);
  const ignoreScrollRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const logKey = useMemo(
    () => (pod ? `${pod.namespace}-${pod.name}` : "logs"),
    [pod]
  );

  const appendLinesSafely = useCallback((lines: string[]) => {
    if (!lines.length) return;
    const target = logRef.current;
    if (target) {
      target.appendLines(lines);
      return;
    }
    pendingLinesRef.current.push(...lines);
  }, []);

  // Flush any buffered lines once the ref becomes ready.
  useEffect(() => {
    if (logRef.current && pendingLinesRef.current.length > 0) {
      logRef.current.appendLines(pendingLinesRef.current);
      pendingLinesRef.current = [];
    }
  });

  const handleScroll = useCallback(
    ({
      scrollTop,
      scrollHeight,
      clientHeight,
    }: {
      scrollTop: number;
      scrollHeight: number;
      clientHeight: number;
    }) => {
      if (ignoreScrollRef.current) return;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      const isNearBottom = distanceFromBottom <= 8;
      if (follow && !isNearBottom) {
        setFollow(false);
      }
    },
    [follow]
  );

  const resumeFollow = useCallback(() => {
    ignoreScrollRef.current = true;
    setFollow(true);
    setTimeout(() => {
      ignoreScrollRef.current = false;
    }, 150);
  }, []);

  useEffect(() => {
    if (!pod || !openShiftClient) {
      return;
    }

    const abortController = new AbortController();
    abortRef.current = abortController;
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
    let cancelled = false;
    let stopWatching: (() => void) | null = null;

    // reset UI state on pod change
    setLineCount(0);
    setFollow(true);
    setError(null);

    const canStreamFromPhase = (phase: string | undefined) =>
      phase !== "Pending" && phase !== "Unknown";

    const startStreaming = async () => {
      try {
        setStatus("connecting");
        reader = await openShiftClient.streamLogs(pod.name, {
          namespace: pod.namespace,
          container: pod.containers[0],
          signal: abortController.signal,
          tailLines: 10000,
        });
        setStatus("streaming");
        let buffered = "";
        const flushBuffered = () => {
          const segments = buffered.split("\n");
          buffered = segments.pop() ?? "";
          const nextLines = segments.filter((segment) => segment.length > 0);
          if (nextLines.length === 0) {
            return;
          }
          appendLinesSafely(
            nextLines.map((line) =>
              line.replace(
                /^[\t\s]*\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})\s*/,
                ""
              )
            )
          );
          setLineCount((prev) => prev + nextLines.length);
        };

        while (!cancelled) {
          const { value, done } = await reader.read();
          if (value) {
            buffered += textDecoder.decode(value, { stream: true });
            flushBuffered();
          }
          if (done) {
            flushBuffered();
            break;
          }
        }
      } catch (streamError) {
        if (
          cancelled ||
          (streamError instanceof DOMException &&
            streamError.name === "AbortError")
        ) {
          return;
        }
        setStatus("error");
        setError(streamError as Error);
      }
    };

    if (canStreamFromPhase(pod.phase)) {
      startStreaming();
    } else {
      setStatus("idle");
      stopWatching = openShiftClient.watchPods(
        (evt) => {
          if (evt.pod.name !== pod.name) return;
          if (canStreamFromPhase(evt.pod.phase) && !cancelled) {
            stopWatching?.();
            stopWatching = null;
            startStreaming();
          }
        },
        {
          namespace: pod.namespace,
          fieldSelector: `metadata.name=${pod.name}`,
          onError: (err) => {
            if (!cancelled) {
              setStatus("error");
              setError(err);
            }
          },
        }
      );
    }

    return () => {
      cancelled = true;
      abortController.abort();
      reader?.cancel().catch(() => undefined);
      stopWatching?.();
      abortRef.current = null;
    };
  }, [appendLinesSafely, openShiftClient, pod]);

  const abortStreaming = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return {
    status,
    error,
    lineCount,
    follow,
    handleScroll,
    resumeFollow,
    logRef: logRef as RefObject<LazyLog>,
    logKey,
    abortStreaming,
  };
};
