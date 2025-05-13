document.addEventListener("DOMContentLoaded", function() {
    var player;
    //Youtube Funtions
    window.playCurrentVideo = function(event) {
        event.target.playVideo();
    }
    window.extractVideoID = function(url) {
        var regExp = /^.*((youtu-nocookie.com\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?)|\/feeds\/api\/videos\/|\/user\S*[^\w\-\s]|\/ytscreeningroom\?)\??v?=?([^#\&\?]*).*/;
        var youtubeID = "";
        var match = url.match(regExp);
        if (match && match[7].length == 11) {
            youtubeID = match[7];
        } else {
            var list = url.match("list=([a-zA-Z0-9\-\_]+)&?");
            list = list ? list[1] : match[7];
            youtubeID = list;
        }
        return youtubeID;
    }
    window.formYoutubePlaylist = function(playerID, youtubeID, dimension) {
        player = new YT.Player(playerID, {
            height: dimension.height,
            width: dimension.width,
            playerVars: {
                listType: 'playlist',
                list: youtubeID
            },
            host: 'https://www.youtube-nocookie.com',
            events: {
                'onReady': playCurrentVideo,
                'onStateChange': onPlayerStateChange
            }
        });
    }
    window.formYoutubePlayer = function(playerID, youtubeID, dimension) {
        player = new YT.Player(playerID, {
            height: dimension.height,
            width: dimension.width,
            videoId: youtubeID,
            host: 'https://www.youtube-nocookie.com',
            events: {
                'onReady': playCurrentVideo,
                'onStateChange': onPlayerStateChange
            }
        });
    }
    window.iframeCreation = function(youtubeID, currEle, dimension) {
        while (currEle.firstChild) {
            currEle.removeChild(currEle.firstChild);
        }
        var div = document.createElement("div");
        div.setAttribute("id", "player-" + youtubeID);
        currEle.appendChild(div);
        var playerID = currEle.querySelector("div").getAttribute('id');
        if (youtubeID.length > 11) {
            formYoutubePlaylist(playerID, youtubeID, dimension);
        } else {
            formYoutubePlayer(playerID, youtubeID, dimension);
        }
    }
    window.lightboxVariant = function(YTele) {
        console.log(YTele);
    }
    window.thumbnailVariant = function(YTele, dimension) {
        var currentYTEle = YTele[0];
        var videoInstances = currentYTEle.querySelectorAll(".videowrap");
        var videoInstanceLen = videoInstances.length;
        for (let k = 0; k < videoInstanceLen; k++) {
            videoInstances[k].addEventListener('click', function(e) {
				e.preventDefault();
                var thePath = this.querySelector(".videoPlayer").getAttribute("video-id");
                var youtubeURL = thePath.split("/").slice(-1).join().split(".").shift();
                if (!youtubeURL) {
                    return;
                }
                var youtubeID = youtubeURL;
                var placeholderDiv = this.querySelector(".videoPlayer");
                placeholderDiv.classList.add("active");
                while (placeholderDiv.firstChild) {
                    placeholderDiv.removeChild(placeholderDiv.firstChild);
                }
                this.querySelector(".videoImageWrapper").style.display = "none";
                this.querySelector(".playButton").style.display = "none";
                var div = document.createElement("div");
                div.setAttribute("id", "player-" + youtubeID);
                placeholderDiv.appendChild(div);
                var playerID = placeholderDiv.querySelector("div").getAttribute('id');
                if (youtubeID.length > 11) {
                    formYoutubePlaylist(playerID, youtubeID, dimension);
                } else {
                    formYoutubePlayer(playerID, youtubeID, dimension);
                }
            })
        }
    }
    if (typeof window["YTVideoSelector"] === "object") {
        var videoElems = Object.keys(YTVideoSelector)
        var videoEleLen = videoElems.length;
        if (videoEleLen > 0) {
            for (let j = 0; j < videoEleLen; j++) {
                var YTele = document.querySelectorAll(YTVideoSelector[videoElems[j]]['videoWrapEle']);
                if (YTele.length > 0) {
                    var YTeleVar = YTVideoSelector[videoElems[j]]['variant'];
                    switch (YTeleVar) {
                        case 'thumbnail':
                            thumbnailVariant(YTele, YTVideoSelector[videoElems[j]]);
                            break;
                        case 'lightbox':
                            lightboxVariant(YTele, YTVideoSelector[videoElems[j]]);
                    }
                }
            }
        }
    }
});