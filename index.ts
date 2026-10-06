/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Naystie
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { proxyLazy } from "@utils/lazy";
import definePlugin from "@utils/types";
import { ReactDOM, useLayoutEffect, zustandCreate } from "@webpack/common";
import type { RefObject } from "react";

type WrapperRef = RefObject<HTMLElement | null>;
type ZoomState = Record<string, boolean>;

interface Point {
    x: number;
    y: number;
}

interface ZoomContext {
    zoomLevel: number;
    minZoom: number;
    videoAspectRatio: number;
    wrapperRef: WrapperRef;
    setPanOffset(update: (pan: Point) => Point): void;
    clampPanOffset(pan: Point): Point;
}

const useZoomStore = proxyLazy(() => zustandCreate((): ZoomState => ({})));
const contexts = new WeakMap<WrapperRef, ZoomContext>();

function fitVideo(ref: WrapperRef, width: number, height: number) {
    const ratio = contexts.get(ref)?.videoAspectRatio;
    if (!ratio) return [width, height];

    const fitted = Math.min(width, height * ratio);
    return [fitted, fitted / ratio];
}

function clampPan(ref: WrapperRef) {
    const context = contexts.get(ref);
    context?.setPanOffset(context.clampPanOffset);
}

export default definePlugin({
    name: "StreamZoomFill",
    description: "No more black bars when you zoom into a stream",
    authors: [{ name: "Nays", id: 344871509677965313n }],
    tags: ["Voice", "Media", "Utility"],

    patches: [
        {
            find: "videoAspectRatio:16/9",
            group: true,
            replacement: [
                {
                    // let the call view know that the stream is zoomed in
                    match: /(?=return\(0,\i\.jsx\)\(\i\.Provider,\{value:(\i),children)/,
                    replace: "$self.useZoomState(arguments[0].streamKey,$1);"
                },
                {
                    // panning limits depend on the video not the box size
                    match: /(?<=(\i)\.current\.clientHeight,)(\i)=\i\*\((\i)-1\)\/2,(\i)=\i\*\(\3-1\)\/2/,
                    replace: "[$2,$4]=$self.panBounds($1,$3)"
                }
            ]
        },
        {
            // zoomed in streams fill the whole view just like activities do
            find: "focused:!0,noBorder:",
            replacement: {
                match: /(?<=let \i=)\i\.useMemo\(\(\)=>\i&&\i\?(\i\/\(\i-2\*\i\)):.{0,150}?\]\)/,
                replace: "$self.useAspectRatio(arguments[0].selectedParticipant.id,$&,$1)"
            }
        },
        {
            // minimap box and click interactions are based on the video size not the box
            find: "--custom-zoom-minimap-width",
            replacement: [
                {
                    match: /(?<=null!=\i\.current\?(\i)\.current\.clientHeight:1,)(\i)=1\/(\i),(\i)=1\/\3,(\i)=\.5-(\i)\.x\/\(\i\*\3\),(\i)=\.5-\6\.y\/\(\i\*\3\)/,
                    replace: "[$2,$4,$5,$7]=$self.indicator($1,$3,$6)"
                },
                {
                    match: /(\i)=(\i)\.current\.clientWidth,(\i)=\2\.current\.clientHeight(?=,\i=\i\.x-\i\.left)/,
                    replace: "[$1,$3]=$self.videoSize($2)"
                }
            ]
        },
        {
            find: "--custom-pan-x",
            replacement: [
                {
                    // keep the same area centered when resizing the view
                    match: /(\((\i),\i\.useCallback\(\i=>\{let\{width:\i,height:\i\}=\i;.{0,250}?)(\i)=(\i)\*\((\i)-1\)\/2,(\i)=(\i)\*\(\5-1\)\/2,(\i)=(\i)\*\(\5-1\)\/2,(\i)=(\i)\*\(\5-1\)\/2/,
                    replace: "$1[$3,$6]=$self.fitVideo($2,$4,$7),[$8,$10]=$self.fitVideo($2,$9,$11)"
                },
                {
                    // discord remembers the size of the last zoom and doesn't clamp when the box first grows
                    match: /(?<=\((\i),\i\.useCallback\(\i=>\{let\{width:\i,height:\i\}=\i;)if\(!(\i)\|\|(null==.{0,80}?\{(\i)\.current=\{width:\i,height:\i\};)return\}/,
                    replace: "if(!$2){$4.current=null;return}if($3$self.clampPan($1);return}"
                }
            ]
        }
    ],

    useZoomState(streamKey: string, context: ZoomContext) {
        const { zoomLevel, minZoom, videoAspectRatio, wrapperRef } = context;
        const zoomed = zoomLevel > minZoom;
        contexts.set(wrapperRef, context);

        useLayoutEffect(() => {
            if (!zoomed) return;

            useZoomStore.setState({ [streamKey]: true });
            return () => useZoomStore.setState({ [streamKey]: false });
        }, [streamKey, zoomed]);

        useLayoutEffect(() => {
            if (zoomed) clampPan(wrapperRef);
        }, [videoAspectRatio]);
    },

    useAspectRatio(participantId: string, aspectRatio: number, fillAspectRatio: number) {
        return useZoomStore((state: ZoomState) => state[participantId]) ? fillAspectRatio : aspectRatio;
    },

    panBounds(ref: WrapperRef, zoom: number) {
        const { clientWidth, clientHeight } = ref.current!;
        const [width, height] = fitVideo(ref, clientWidth, clientHeight);
        return [
            Math.max(0, (width * zoom - clientWidth) / 2),
            Math.max(0, (height * zoom - clientHeight) / 2)
        ];
    },

    indicator(ref: WrapperRef, zoom: number, pan: Point) {
        const wrapper = ref.current;
        if (!wrapper) return [1, 1, 0.5, 0.5];

        const { clientWidth, clientHeight } = wrapper;
        const [width, height] = fitVideo(ref, clientWidth, clientHeight);
        return [
            Math.min(1, clientWidth / (width * zoom)),
            Math.min(1, clientHeight / (height * zoom)),
            0.5 - pan.x / (width * zoom),
            0.5 - pan.y / (height * zoom)
        ];
    },

    videoSize(ref: WrapperRef) {
        const { clientWidth, clientHeight } = ref.current!;
        return fitVideo(ref, clientWidth, clientHeight);
    },

    clampPan(ref: WrapperRef) {
        ReactDOM.flushSync(() => clampPan(ref));
    },

    fitVideo
});
