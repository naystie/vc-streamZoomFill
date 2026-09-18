# streamzoomfill

lets a zoomed in stream fill the whole video area instead of staying inside its 16:9 box.

## why

discord fits a stream into a box with the same aspect ratio as the video and zooming only ever happens inside that box. on a portrait monitor (or anything that isn't the shape of the stream) that leaves most of the screen black no matter how far you zoom in.

## what changes

- once you zoom past 100% the focused tile grows to the whole video area
- panning is clamped to the video itself, so it can't be dragged off screen
- the minimap and click to pan know about the bigger tile
- at 100% nothing is touched

## install

if you made it here you probably already know how to install custom plugins, but if not just check [vencord's guide](https://docs.vencord.dev/installing/custom-plugins/).
