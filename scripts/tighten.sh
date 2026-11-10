#!/bin/zsh
# Re-encode one oversized web video with a bitrate cap. $1 = web file, $2 = original, $3 = tmp dir
ffmpeg -y -loglevel error -i "$2" -vf "scale='if(gt(iw,ih),-2,min(720,iw))':'if(gt(iw,ih),min(720,ih),-2)'" -c:v libx264 -preset veryfast -crf 30 -maxrate 1300k -bufsize 2600k -pix_fmt yuv420p -c:a aac -b:a 80k -movflags +faststart "$3/$(basename $1)" && [ "$(stat -f%z "$3/$(basename $1)")" -lt "$(stat -f%z "$1")" ] && mv "$3/$(basename $1)" "$1"
