/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Nays
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { proxyLazy } from "@utils/lazy";
import definePlugin from "@utils/types";
import { useEffect, zustandCreate } from "@webpack/common";
import type { RefObject } from "react";

type ZoomState = Partial<Record<string, boolean>>;

const useZoomStore = proxyLazy(() => zustandCreate(() => ({})));
const ratios = new WeakMap<HTMLElement, number>();

function baseSize(wrapper: HTMLElement) {
    const { clientWidth, clientHeight } = wrapper;
    const ratio = ratios.get(wrapper) ?? clientWidth / clientHeight;
    const width = Math.min(clientWidth, clientHeight * ratio);

    return [width, width / ratio];
}

export default definePlugin({
    name: "StreamZoomFill",
    description: "Lets a zoomed in stream fill the whole video area instead of staying inside its 16:9 box",
    authors: [{ name: "Nays", id: 344871509677965313n }],
    tags: ["Voice", "Media"],

    patches: [
        {
            find: "videoAspectRatio:16/9",
            replacement: [
                {
                    match: /\{streamKey:(\i),minZoom:(\i)=.{0,40}?\[(\i),\i\]=(\i)\.useState\(\2\),.{0,120}?\[(\i),\i\]=\4\.useState\(16\/9\),.{0,60}?(\i)=\4\.useRef\(null\),\i=\4\.useRef\(null\);/,
                    replace: "$&$self.useZoomState($1,$3>$2,$6,$5);"
                },
                {
                    match: /(\i)=(\i)\.current\.clientWidth,(\i)=\2\.current\.clientHeight,(\i)=\1\*\((\i)-1\)\/2,(\i)=\3\*\(\5-1\)\/2;/,
                    replace: "$&[$4,$6]=$self.panBounds($2.current,$5);"
                }
            ]
        },
        {
            find: "focused:!0,noBorder:",
            replacement: {
                match: /let (\i)=\i\.useMemo\(\(\)=>(\i&&\i\?\i\/\(\i-2\*\i\):.{0,80}?),\[\i(?:,\i)*\]\)/,
                replace: "let $1=$self.useZoomed(arguments[0].selectedParticipant.id)||$2"
            }
        },
        {
            find: "--custom-zoom-minimap-width",
            replacement: [
                {
                    match: /let (\i)=null!=(\i)\.current\?\2\.current\.clientWidth:1,(\i)=null!=\2\.current\?\2\.current\.clientHeight:1,(\i)=1\/(\i),(\i)=1\/\5,(\i)=\.5-(\i)\.x\/\(\1\*\5\),(\i)=\.5-\8\.y\/\(\3\*\5\)/,
                    replace: "let [$4,$6,$7,$9]=$self.indicator($2.current,$5,$8)"
                },
                {
                    match: /(\i)=(\i)\.current\.clientWidth,(\i)=\2\.current\.clientHeight,(\i)=(\i)\.x-(\i)\.left,/,
                    replace: "[$1,$3]=$self.baseSize($2.current),$4=$5.x-$6.left,"
                }
            ]
        }
    ],

    useZoomState(streamKey: string, zoomed: boolean, wrapperRef: RefObject<HTMLElement>, ratio: number) {
        useEffect(() => {
            if (wrapperRef.current) ratios.set(wrapperRef.current, ratio);
            useZoomStore.setState({ [streamKey]: zoomed });
            return () => useZoomStore.setState({ [streamKey]: false });
        }, [streamKey, zoomed, ratio]);
    },

    useZoomed(streamKey: string): boolean {
        return useZoomStore((state: ZoomState) => state[streamKey] ?? false);
    },

    baseSize,

    panBounds(wrapper: HTMLElement, zoom: number) {
        const [width, height] = baseSize(wrapper);

        return [
            Math.max(0, (width * zoom - wrapper.clientWidth) / 2),
            Math.max(0, (height * zoom - wrapper.clientHeight) / 2)
        ];
    },

    indicator(wrapper: HTMLElement | null, zoom: number, pan: { x: number; y: number; }) {
        if (!wrapper) return [1 / zoom, 1 / zoom, 0.5, 0.5];

        const [width, height] = baseSize(wrapper);

        return [
            Math.min(1, wrapper.clientWidth / (width * zoom)),
            Math.min(1, wrapper.clientHeight / (height * zoom)),
            0.5 - pan.x / (width * zoom),
            0.5 - pan.y / (height * zoom)
        ];
    }
});
