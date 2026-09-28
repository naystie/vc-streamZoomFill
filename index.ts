/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Nays
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { proxyLazy } from "@utils/lazy";
import definePlugin from "@utils/types";
import { useLayoutEffect, zustandCreate } from "@webpack/common";
import type { RefObject } from "react";

type WrapperRef = RefObject<HTMLElement | null>;
type ZoomState = Partial<Record<string, boolean>>;

interface ZoomContext {
    zoomLevel: number;
    minZoom: number;
    videoAspectRatio: number;
    wrapperRef: WrapperRef;
}

const useZoomStore = proxyLazy(() => zustandCreate(() => ({})));
const ratios = new WeakMap<WrapperRef, number>();

function fitVideo(ref: WrapperRef, width: number, height: number) {
    const ratio = ratios.get(ref);
    if (!ratio || !width || !height) return [width, height];

    const fitted = Math.min(width, height * ratio);
    return [fitted, fitted / ratio];
}

function videoSize(ref: WrapperRef) {
    const wrapper = ref.current;
    return wrapper ? fitVideo(ref, wrapper.clientWidth, wrapper.clientHeight) : [1, 1];
}

export default definePlugin({
    name: "StreamZoomFill",
    description: "Lets a zoomed in stream fill the whole video area instead of staying inside its 16:9 box",
    authors: [{ name: "Nays", id: 344871509677965313n }],
    tags: ["Voice", "Media"],

    patches: [
        {
            find: "videoAspectRatio:16/9",
            group: true,
            replacement: [
                {
                    match: /(?=return\(0,\i\.jsx\)\(\i\.Provider,\{value:(\i),children)/,
                    replace: "$self.useZoomState(arguments[0].streamKey,$1);"
                },
                {
                    match: /(?<=(\i)\.current\.clientHeight,)(\i)=\i\*\((\i)-1\)\/2,(\i)=\i\*\(\3-1\)\/2/,
                    replace: "[$2,$4]=$self.panBounds($1,$3)"
                }
            ]
        },
        {
            find: "focused:!0,noBorder:",
            replacement: {
                match: /let (\i)=\i\.useMemo\(\(\)=>(\i&&\i\?(\i\/\(\i-2\*\i\)):.{0,150}?),\[\i(?:,\i)*\]\)/,
                replace: "let $1=$self.useZoomed(arguments[0].selectedParticipant.id)?$3:$2"
            }
        },
        {
            find: "--custom-zoom-minimap-width",
            group: true,
            replacement: [
                {
                    match: /let (\i)=null!=(\i)\.current\?\2\.current\.clientWidth:1,(\i)=null!=\2\.current\?\2\.current\.clientHeight:1,(\i)=1\/(\i),(\i)=1\/\5,(\i)=\.5-(\i)\.x\/\(\1\*\5\),(\i)=\.5-\8\.y\/\(\3\*\5\)/,
                    replace: "let [$4,$6,$7,$9]=$self.indicator($2,$5,$8)"
                },
                {
                    match: /(\i)=(\i)\.current\.clientWidth,(\i)=\2\.current\.clientHeight(?=,\i=\i\.x-\i\.left,)/,
                    replace: "[$1,$3]=$self.videoSize($2)"
                }
            ]
        },
        {
            find: "--custom-pan-x",
            replacement: {
                match: /(?<=\(0,\i\.\i\)\((\i),\i\.useCallback\(\i=>\{.{0,300}?)(\i)=(\i)\*\((\i)-1\)\/2,(\i)=(\i)\*\(\4-1\)\/2,(\i)=(\i)\*\(\4-1\)\/2,(\i)=(\i)\*\(\4-1\)\/2/,
                replace: "[$2,$5,$7,$9]=$self.resizeScale($1,$3,$6,$8,$10)"
            }
        }
    ],

    useZoomState(streamKey: string, { zoomLevel, minZoom, videoAspectRatio, wrapperRef }: ZoomContext) {
        ratios.set(wrapperRef, videoAspectRatio);
        const zoomed = zoomLevel > minZoom;

        useLayoutEffect(() => {
            if (!zoomed) return;

            useZoomStore.setState({ [streamKey]: true });
            return () => useZoomStore.setState({ [streamKey]: false });
        }, [streamKey, zoomed]);
    },

    useZoomed(streamKey: string): boolean {
        return useZoomStore((state: ZoomState) => state[streamKey] ?? false);
    },

    videoSize,

    panBounds(ref: WrapperRef, zoom: number) {
        const wrapper = ref.current;
        if (!wrapper) return [0, 0];

        const [width, height] = videoSize(ref);
        return [
            Math.max(0, (width * zoom - wrapper.clientWidth) / 2),
            Math.max(0, (height * zoom - wrapper.clientHeight) / 2)
        ];
    },

    indicator(ref: WrapperRef, zoom: number, pan: { x: number; y: number; }) {
        const wrapper = ref.current;
        const [width, height] = videoSize(ref);
        if (!wrapper || !width || !height) return [1 / zoom, 1 / zoom, 0.5, 0.5];

        return [
            Math.min(1, wrapper.clientWidth / (width * zoom)),
            Math.min(1, wrapper.clientHeight / (height * zoom)),
            0.5 - pan.x / (width * zoom),
            0.5 - pan.y / (height * zoom)
        ];
    },

    resizeScale(ref: WrapperRef, oldWidth: number, oldHeight: number, width: number, height: number) {
        return [...fitVideo(ref, oldWidth, oldHeight), ...fitVideo(ref, width, height)];
    }
});
