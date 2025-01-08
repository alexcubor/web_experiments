let cap, grayPrev, grayNext;
let pointsPrev = [];
let tracks = {};
let nextID = 0;
const maxTrackLength = 20;
const driftThreshold = 30;
let currentStream = null;

const container = document.getElementById('container');

// Функция запуска камеры
function startCamera() {
    const cameraMode = container.getAttribute('data-camera');

    // Формирование параметров для getUserMedia
    const constraints = {
        video: cameraMode ? { facingMode: cameraMode } : true
    };

    // Остановка текущего потока (если есть)
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
    }

    // Запуск камеры
    navigator.mediaDevices.getUserMedia(constraints)
        .then(stream => {
            currentStream = stream;
            video.srcObject = stream;
        })
        .catch(err => console.error("Ошибка доступа к камере:", err));
}

// Запуск камеры при загрузке страницы
window.addEventListener('load', startCamera);


// Основная логика трекинга
video.addEventListener('play', () => {
    cap = new cv.VideoCapture(video);
    grayPrev = new cv.Mat(video.height, video.width, cv.CV_8UC1);
    grayNext = new cv.Mat(video.height, video.width, cv.CV_8UC1);

    track();
});

function track() {
    if (!video.paused && !video.ended) {
        let frame = new cv.Mat(video.height, video.width, cv.CV_8UC4);
        cap.read(frame);
        cv.cvtColor(frame, grayNext, cv.COLOR_RGBA2GRAY);

        if (pointsPrev.length > 0) {
            let [points1, status] = lucasKanade(grayPrev, grayNext, pointsPrev);
            updateTracks(points1, status);
            status.delete();
        } else {
            detectFeatures(grayNext);
        }

        cv.imshow(canvas, frame);
        drawTracks(tracks);
        frame.delete();
        grayNext.copyTo(grayPrev);
        requestAnimationFrame(track);
    }
}

function detectFeatures(img) {
    let corners = new cv.Mat();
    cv.goodFeaturesToTrack(img, corners, 100, 0.01, 10);
    let newPoints = Array.from(corners.data32F)
        .map((val, i) => i % 2 === 0 ? [val, corners.data32F[i + 1]] : null)
        .filter(x => x);

    newPoints.forEach(point => {
        let id = nextID++;
        tracks[id] = {
            points: [point],
            lost: false
        };
    });

    pointsPrev = newPoints;
    corners.delete();
}

function lucasKanade(prev, next, points) {
    let p0 = cv.matFromArray(points.length, 1, cv.CV_32FC2, points.flat());
    let p1 = new cv.Mat();
    let status = new cv.Mat();
    let err = new cv.Mat();

    cv.calcOpticalFlowPyrLK(prev, next, p0, p1, status, err);

    let newPoints = [];
    for (let i = 0; i < p1.rows; i++) {
        if (status.data[i]) {
            newPoints.push([p1.data32F[i * 2], p1.data32F[i * 2 + 1]]);
        }
    }

    p0.delete();
    p1.delete();
    err.delete();

    return [newPoints, status];
}

function updateTracks(points, status) {
    let newTracks = {};
    let newPoints = [];

    let index = 0;
    Object.keys(tracks).forEach(id => {
        if (status.data[index] && points[index]) {
            const dx = Math.abs(points[index][0] - tracks[id].points[tracks[id].points.length - 1][0]);
            const dy = Math.abs(points[index][1] - tracks[id].points[tracks[id].points.length - 1][1]);

            if (dx < driftThreshold && dy < driftThreshold) {
                tracks[id].points.push(points[index]);
                if (tracks[id].points.length > maxTrackLength) {
                    tracks[id].points.shift();
                }
                newTracks[id] = tracks[id];
                newPoints.push(points[index]);
            }
        }
        index++;
    });

    tracks = newTracks;
    pointsPrev = newPoints;
}
