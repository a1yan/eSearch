/// <reference types="vite/client" />
// @ts-strict-ignore
import { initStyle } from "../root/root";
import { select } from "dkh-ui";
import "../../../lib/template2.js";
import { t, lan } from "../../../lib/translate/translate";
import pauseSvg from "../assets/icons/pause.svg";
import recumeSvg from "../assets/icons/recume.svg";

const micEl = document.getElementById("mic") as HTMLInputElement;
const cameraEl = document.getElementById("camera") as HTMLInputElement;
const saveEl = document.getElementById("save") as HTMLButtonElement;
const 格式El = document.getElementById("格式") as HTMLInputElement;
const tStartEl: timeEl = document.getElementById(
    "t_start",
) as unknown as timeEl;
const tEndEl = document.getElementById("t_end") as unknown as timeEl;
const jdtEl = document.getElementById("jdt") as unknown as timeEl;

type timeEl = {
    value: number;
    min: number;
    max: number;
} & HTMLElement;

import store from "../../../lib/store/renderStore";
initStyle(store);

lan(store.get("语言.语言"));

let recorder: MediaRecorder;

/** 临时保存的原始视频位置 */
let tmpPath: string;
/** 转换 */
let output: string;

const startStop = document.getElementById("start_stop");
let sS = false;
let stop = false;

const clipTime = Number(store.get("录屏.转换.分段")) * 1000;

startStop.onclick = () => {
    if (sS) {
        startStop.querySelector("div").className = "stop";
        pauseRecume.querySelector("img").src = pauseSvg;
        document.getElementById("time").innerText = "0:00";
        recorder.start();
        格式El.style.display = "none";
        type = 格式El.value as mimeType;
        pTime();
        setInterval(getTime, 500);
        sS = false;
        ipcRenderer.send("record", "start", tmpPath, type);

        c();
    } else {
        stop = true;
        recorder.stop();
        pTime();
    }
};

const pauseRecume = document.getElementById("pause_recume");
pauseRecume.onclick = () => {
    if (recorder.state === "inactive") return;
    if (recorder.state === "recording") {
        pauseRecume.querySelector("img").src = recumeSvg;
        recorder.pause();
        pTime();
    } else if (recorder.state === "paused") {
        pauseRecume.querySelector("img").src = recumeSvg;
        recorder.resume();
        pTime();
    }
};

const nameT: { s: number; e: number }[] = [{ s: 0, e: Number.NaN }];

const timeL = [];
function pTime() {
    const t = new Date().getTime();
    timeL.push(t);
    let d = 0;
    for (let i = 0; i < timeL.length; i += 2) {
        if (timeL[i + 1]) d += timeL[i + 1] - timeL[i];
    }
    ipcRenderer.send("record", "pause_time", {
        t,
        dt: d,
        pause: timeL.length % 2 === 0,
    });
}
function getT() {
    let t = 0;
    for (let i = 1; i < timeL.length - 1; i += 2) {
        t += timeL[i] - timeL[i - 1];
    }
    if (timeL.length % 2 === 0) {
        t += new Date().getTime() - timeL.at(-2);
    } else {
        t += new Date().getTime() - timeL.at(-1);
    }
    return t;
}
function getTime() {
    if (recorder.state === "recording") {
        let t = 0;
        for (let i = 1; i < timeL.length - 1; i += 2) {
            t += timeL[i] - timeL[i - 1];
        }
        t += new Date().getTime() - timeL.at(-1);
        const s = Math.trunc(t / 1000);
        const m = Math.trunc(s / 60);
        const h = Math.trunc(m / 60);
        document.getElementById("time").innerText =
            `${h === 0 ? "" : `${h}:`}${m - 60 * h}:${String(
                s - 60 * m,
            ).padStart(2, "0")}`;
    }
}

addTypes();
type mimeType =
    | "mp4"
    | "webm"
    | "gif"
    | "mkv"
    | "mov"
    | "avi"
    | "ts"
    | "mpeg"
    | "flv";
let type = store.get("录屏.转换.格式") as mimeType;
格式El.value = type;

let audioStream: MediaStream;
let stream: MediaStream;

let audio = false;
let camera = false;

let rect: [number, number, number, number];

const { ipcRenderer } = require("electron") as typeof import("electron");
const spawn = require("node:child_process")
    .spawn as typeof import("child_process").spawn;
const fs = require("node:fs") as typeof import("fs");
const os = require("node:os") as typeof import("os");
const path = require("node:path") as typeof import("path");
import type { MessageBoxSyncOptions } from "electron";
let pathToFfmpeg = "ffmpeg";
if (process.platform === "win32" || process.platform === "darwin") {
    const p = path.join(__dirname, "..", "..", "lib", "ffmpeg");
    const n = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
    pathToFfmpeg = path.join(p, n);
}
const start = spawn(pathToFfmpeg, ["-version"]);
start.on("error", () => {
    const m =
        process.platform === "linux"
            ? "请安装FFmpeg，并确保软件可使用ffmpeg命令"
            : "请重新安装软件，或进行反馈";
    ipcRenderer.send("dialog", {
        message: `FFmpeg用于处理视频，但现在软件无法使用它\n${m}`,
        buttons: ["取消"],
    } as MessageBoxSyncOptions);
});
console.log(pathToFfmpeg);

/** 自动分段 */
function c() {
    if (clipTime === 0) return;
    setTimeout(() => {
        if (!stop) {
            recorder.stop();
            c();
        }
    }, clipTime);
}

ipcRenderer.on("record", async (_event, t, sourceId, r, screen_w, screen_h) => {
    switch (t) {
        case "init": {
            rect = r;
            sS = true;
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioL = devices.filter((i) => i.kind === "audioinput");
            const videoL = devices.filter((i) => i.kind === "videoinput");
            if (audioL.length) audio = true;
            if (videoL.length) camera = true;
            if (audio) {
                const id =
                    audioL.find(
                        (i) => i.deviceId === store.get("录屏.音频.设备"),
                    )?.deviceId ?? audioL[0].deviceId;
                audioStream = await navigator.mediaDevices.getUserMedia({
                    audio: { deviceId: id },
                    video: false,
                });
                if (audioL.length > 1) {
                    const selectEl = select(
                        audioL.map((i) => ({
                            name: i.label,
                            value: i.deviceId,
                        })),
                    )
                        .sv(id)
                        .on("change", async () => {
                            audioStream =
                                await navigator.mediaDevices.getUserMedia({
                                    audio: { deviceId: selectEl.gv },
                                    video: false,
                                });
                            store.set("录屏.音频.设备", selectEl.gv);
                        });
                    micEl.after(selectEl.el);
                }
            } else {
                micEl.style.display = "none";
            }
            if (!camera)
                document.getElementById("camera").style.display = "none";
            else {
                const id =
                    videoL.find(
                        (i) => i.deviceId === store.get("录屏.摄像头.设备"),
                    )?.deviceId ?? videoL[0].deviceId;
                cameraDeviceId = id;
                if (videoL.length > 1) {
                    const selectEl = select(
                        videoL.map((i) => ({
                            name: i.label,
                            value: i.deviceId,
                        })),
                    )
                        .sv(id)
                        .on("change", async () => {
                            cameraDeviceId = selectEl.el.value;
                            if (cameraStream)
                                cameraStream =
                                    await navigator.mediaDevices.getUserMedia({
                                        audio: false,
                                        video: { deviceId: selectEl.el.value },
                                    });
                            store.set("录屏.摄像头.设备", selectEl.el.value);
                        });
                    cameraEl.after(selectEl.el);
                }
            }
            navigator.mediaDevices.ondevicechange = () => {
                navigator.mediaDevices.enumerateDevices().then((d) => {
                    let video = false;
                    for (const i of d) {
                        if (i.kind === "videoinput") video = true;
                    }
                    if (video) {
                        document.getElementById("camera").style.display = "";
                    } else {
                        document.getElementById("camera").style.display =
                            "none";
                        cameraStreamF(false);
                    }
                });
            };
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        // @ts-ignore
                        mandatory: {
                            chromeMediaSource: "desktop",
                        }
                    },
                    video: {
                        // @ts-ignore
                        mandatory: {
                            chromeMediaSource: "desktop",
                            chromeMediaSourceId: sourceId,
                            minWidth: screen_w,
                            minHeight: screen_h,
                        },
                    },
                });
            } catch (e) {
                console.error(e);
            }
            if (!stream) return;
            if (audioStream) {
                for (const i of audioStream.getAudioTracks())
                    stream.addTrack(i);
                micStream(store.get("录屏.音频.默认开启"));
            }
            let chunks = [];
            recorder = new MediaRecorder(stream, {
                videoBitsPerSecond: store.get("录屏.视频比特率") * 10 ** 6,
                mimeType: "video/webm",
            });
            document.getElementById("record_b").style.opacity = "1";
            document.getElementById("record_b").style.pointerEvents = "auto";
            recorder.ondataavailable = (e) => {
                chunks.push(e.data);
            };

            const fileName = String(new Date().getTime());
            tmpPath = path.join(os.tmpdir(), "eSearch/", fileName);
            output = path.join(tmpPath, "output");
            fs.mkdirSync(tmpPath);
            fs.mkdirSync(output);
            let clipName = 0;
            function save(f: () => void) {
                const b = new Blob(chunks, { type: "video/webm" });
                console.log(chunks, b);
                const reader = new FileReader();
                reader.readAsArrayBuffer(b);
                reader.onloadend = (_e) => {
                    const baseName = String(clipName);
                    const baseName2 = `${baseName}.${type}`;
                    const p = path.join(tmpPath, baseName);
                    const crop =
                        type === "gif" && store.get("录屏.转换.高质量gif")
                            ? `[in]crop=${rect[2]}:${rect[3]}:${rect[0]}:${rect[1]},split[split1][split2];[split1]palettegen=stats_mode=single[pal];[split2][pal]paletteuse=new=1`
                            : `crop=${rect[2]}:${rect[3]}:${rect[0]}:${rect[1]}`;
                    const args = [
                        "-i",
                        p,
                        "-vf",
                        crop,
                        path.join(output, baseName2),
                    ];
                    fs.writeFile(
                        p,
                        Buffer.from(reader.result as string),
                        (_err) => {
                            runFfmpeg("ts", clipName, args);
                            chunks = [];
                            if (f) f();
                            clipName++;
                        },
                    );
                };
            }

            recorder.onstop = () => {
                nameT.at(-1).e = getT();
                if (stop) {
                    ipcRenderer.send("record", "stop");
                    save(showControl);
                    console.log(nameT);
                } else {
                    save(null);
                    recorder.start();
                    nameT.push({ s: getT(), e: Number.NaN });
                }
            };

            if (store.get("录屏.自动录制")) {
                let t = store.get("录屏.自动录制");
                function d() {
                    if (t === false) return;
                    if (recorder.state !== "inactive") return;
                    document.getElementById("time").innerText = String(t);
                    setTimeout(() => {
                        if (t === 0) {
                            startStop.click();
                        } else {
                            if (t !== false) {
                                t--;
                                d();
                            }
                        }
                    }, 1000);
                }
                d();
            }
            break;
        }
        case "start_stop":
            startStop.click();
            break;
    }
});

document.getElementById("min").onclick = () => {
    ipcRenderer.send("record", "min");
};

document.getElementById("close").onclick = () => {
    ipcRenderer.send("record", "close");
};

async function micStream(v) {
    for (const i of audioStream.getAudioTracks()) {
        i.enabled = v;
    }
    if (v !== micEl.checked) micEl.checked = v;
}

micEl.onclick = () => {
    try {
        micStream(micEl.checked);
        if (store.get("录屏.音频.记住开启状态"))
            store.set("录屏.音频.默认开启", micEl.checked);
    } catch (e) {
        console.error(e);
    }
};

const videoEl = document.querySelector("video");

let cameraStream: MediaStream;
let cameraDeviceId = "";
async function cameraStreamF(v: boolean) {
    if (v) {
        cameraStream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: { deviceId: cameraDeviceId },
        });
        videoEl.srcObject = cameraStream;
        videoEl.play();
        if (store.get("录屏.摄像头.镜像"))
            document.getElementById("video").style.transform =
                "rotateY(180deg)";
        ipcRenderer.send("record", "camera", 0);
        setTimeout(() => {
            resize();
        }, 400);

        videoEl.oncanplay = () => {
            initSeg();
        };
    } else {
        cameraStream.getVideoTracks()[0].stop();
        videoEl.srcObject = null;
        ipcRenderer.send("record", "camera", 1);
    }
}

if (store.get("录屏.摄像头.默认开启")) {
    try {
        cameraStreamF(true);
        cameraEl.checked = true;
    } catch (e) {
        console.error(e);
    }
}

cameraEl.onclick = () => {
    try {
        cameraStreamF(cameraEl.checked);
        if (store.get("录屏.摄像头.记住开启状态"))
            store.set("录屏.摄像头.默认开启", cameraEl.checked);
    } catch (e) {
        console.error(e);
    }
};

document.body.onresize = resize;

function resize() {
    const p = {
        h: document.getElementById("video").offsetHeight,
        w: document.getElementById("video").offsetWidth,
    };
    const c = {
        h: document.getElementById("v_p").offsetHeight,
        w: document.getElementById("v_p").offsetWidth,
    };
    const k0 = p.h / p.w;
    const k1 = c.h / c.w;
    if (k0 >= k1) {
        console.log(p.w, c.w);
        // @ts-ignore
        document.getElementById("v_p").style.zoom = p.w / c.w;
    } else {
        // @ts-ignore
        document.getElementById("v_p").style.zoom = p.h / c.h;
    }
}

let seg: typeof import("esearch-seg");

let cameraCanvas: HTMLCanvasElement = document.createElement("canvas");
let segCanvas: HTMLCanvasElement = document.createElement("canvas");
const segEl = document.getElementById("seg");

async function initSeg() {
    const bgSetting = store.get("录屏.摄像头.背景");
    if (bgSetting.模式 === "none") {
        return;
    }
    videoEl.style.display = "";
    segEl.innerHTML = "";
    videoEl.style.display = "none";
    cameraCanvas = document.createElement("canvas");
    segCanvas = document.createElement("canvas");
    const bgEl = document.createElement("div");
    if (bgSetting.模式 === "img" || bgSetting.模式 === "video") {
        const bg =
            bgSetting.模式 === "img"
                ? document.createElement("img")
                : document.createElement("video");
        const url =
            bgSetting.模式 === "img" ? bgSetting.imgUrl : bgSetting.videoUrl;
        bg.src = url;
        bgEl.append(bg);
        bgEl.style.objectFit = bgSetting.fit;
        cameraCanvas.style.display = "none";
    }
    if (bgSetting.模式 === "blur") {
        cameraCanvas.style.filter = `blur(${bgSetting.模糊}px)`;
        cameraCanvas.style.display = "";
    }
    if (bgSetting.模式 === "hide") {
        cameraCanvas.style.display = "none";
    }
    segEl.append(cameraCanvas, bgEl, segCanvas);
    seg = require("esearch-seg") as typeof import("esearch-seg");
    await seg.init({
        segPath: path.join(__dirname, "../../assets/onnx/seg", "seg.onnx"),
        ort: require("onnxruntime-node"),
        ortOption: {
            executionProviders: [{ name: store.get("AI.运行后端") || "cpu" }],
        },
        shape: [256, 144],
        invertOpacity: true,
        threshold: 0.7,
    });
    drawCamera();
    segEl.style.width = `${videoEl.videoWidth}px`;
    segEl.style.height = `${videoEl.videoHeight}px`;
}

function drawCamera() {
    const canvasCtx = cameraCanvas.getContext("2d");
    cameraCanvas.width = videoEl.videoWidth;
    cameraCanvas.height = videoEl.videoHeight;
    console.log(videoEl.videoHeight);
    canvasCtx.drawImage(videoEl, 0, 0, cameraCanvas.width, cameraCanvas.height);
    seg.seg(
        canvasCtx.getImageData(0, 0, cameraCanvas.width, cameraCanvas.height),
    ).then((data) => {
        segCanvas.width = data.width;
        segCanvas.height = data.height;
        segCanvas.getContext("2d").putImageData(data, 0, 0);
    });
    setTimeout(() => {
        if (cameraStream.active) drawCamera();
    }, 10);
}

ipcRenderer.on("ff", (_e, t, arg) => {
    if (t === "p") {
        document.getElementById("pro").style.width = `${arg * 100}%`;
        if (arg === 1)
            setTimeout(() => {
                ipcRenderer.send("record", "close");
            }, 400);
    }
    if (t === "l") {
        const textarea = <HTMLTextAreaElement>document.getElementById("log");
        textarea.value += `\n${arg[1]}`;
        textarea.scrollTop = textarea.scrollHeight;
    }
    if (t === "save_path") {
        savePath = arg;
        if (isTsOk)
            clip()
                .then(() => joinAndSave(arg))
                .catch(() => {
                    isClipRun = false;
                });
    }
});

let editting = false;

function setVideo(n: number) {
    videoEl.src = `${tmpPath}/${n}`;
}

/** 获取绝对时间 */
function getPlayT() {
    let t = 0;
    for (let i = 0; i < playName; i++) {
        t += nameT[i].e - nameT[i].s;
    }
    t += videoEl.currentTime * 1000;
    return t;
}

/** 通过绝对时间设定视频和其相对时间 */
function setPlayT(time: number) {
    const x = getTimeInV(time);
    setVideo(x.v);
    playName = x.v;
    videoEl.currentTime = x.time / 1000;
}

/** 获取绝对时间对应的视频和相对时间 */
function getTimeInV(time: number) {
    for (let i = 0; i < nameT.length; i++) {
        if (nameT[i].s <= time && time < (nameT?.[i + 1]?.s || nameT[i].e)) {
            return { v: i, time: time - nameT[i].s };
        }
    }
    return { v: 0, time: 0 };
}

function showControl() {
    editting = true;
    document.getElementById("v_play").querySelector("img").src = recumeSvg;
    if (micEl.checked) micStream(false);
    if (cameraEl.checked) cameraStreamF(false);
    document.getElementById("s").className = "s_show";
    document.getElementById("record_b").style.display = "none";
    document.getElementById("m").style.backgroundColor = "var(--bg)";
    document.getElementById("time").innerText = "";
    document.getElementById("video").style.transform = "";
    segEl.remove();
    setVideo(0);
    document.querySelector("video").style.left = `${-rect[0]}px`;
    document.querySelector("video").style.top = `${-rect[1]}px`;
    document.getElementById("v_p").style.width = document.getElementById(
        "v_p",
    ).style.minWidth = `${rect[2]}px`;
    document.getElementById("v_p").style.height = document.getElementById(
        "v_p",
    ).style.minHeight = `${rect[3]}px`;
    clipV();
    saveEl.disabled = false;
    if (store.get("录屏.转换.自动转换")) {
        save();
    } else {
        ipcRenderer.send("record", "camera", 2);
    }
    setTimeout(() => {
        resize();
        document.getElementById("m").style.transition = "none";
    }, 400);
}

let playName = 0;

function clipV() {
    tStartEl.value = 0;
    document.getElementById("b_t_end").click();

    document.getElementById("t_t").innerText = tFormat(
        tEndEl.value - tStartEl.value,
    );

    document.getElementById("t_nt").innerText = tFormat(0);
}

tStartEl.oninput = () => {
    videoEl.currentTime = tEndEl.min = jdtEl.min = tStartEl.value / 1000;
    document.getElementById("t_t").innerText = tFormat(
        tEndEl.value - tStartEl.value,
    );
};
tEndEl.oninput = () => {
    videoEl.currentTime = tStartEl.max = jdtEl.max = tEndEl.value / 1000;
    document.getElementById("t_t").innerText = tFormat(
        tEndEl.value - tStartEl.value,
    );
};

document.getElementById("b_t_end").onclick = () => {
    jdtEl.max =
        tEndEl.value =
        tStartEl.max =
        tEndEl.max =
            timeL.at(-1) - timeL[0];
};

/**
 *
 * @param x 输入秒
 */
function tFormat(x: number) {
    const t = x;
    const s = Math.trunc(t / 1000);
    const m = Math.trunc(s / 60);
    const h = Math.trunc(m / 60);
    return `${h === 0 ? "" : `${h}:`}${m - 60 * h}:${String(s - 60 * m).padStart(2, "0")}.${String(
        t % 1000,
    ).slice(0, 1)}`;
}

document.getElementById("v_play").onclick = () => {
    if (videoEl.paused) {
        videoPlay();
        document.getElementById("v_play").querySelector("img").src = pauseSvg;
    } else {
        videoEl.pause();
        document.getElementById("v_play").querySelector("img").src = recumeSvg;
    }
};

videoEl.onpause = () => {
    document.getElementById("v_play").querySelector("img").src = recumeSvg;
};
videoEl.onplay = () => {
    document.getElementById("v_play").querySelector("img").src = pauseSvg;
};

function videoPlay() {
    setPlayT(tStartEl.value);
    videoEl.play();
}

videoEl.ontimeupdate = () => {
    if (!editting) return;
    document.getElementById("t_nt").innerText = tFormat(
        getPlayT() - tStartEl.value,
    );
    if (getPlayT() > tEndEl.value) {
        videoEl.pause();
        document.getElementById("t_nt").innerText =
            document.getElementById("t_t").innerText;
    }
    jdtEl.value = getPlayT();
};

jdtEl.oninput = () => {
    setPlayT(jdtEl.value);
};

videoEl.onended = () => {
    if (playName < nameT.length - 1) {
        playName++;
        setVideo(playName);
        videoEl.play();
    } else {
        document.getElementById("t_nt").innerText =
            document.getElementById("t_t").innerText;
        jdtEl.value = jdtEl.max;
    }
};

function addTypes() {
    const types: mimeType[] = [
        "mp4",
        "webm",
        "gif",
        "mkv",
        "mov",
        "ts",
        "mpeg",
        "flv",
    ];
    let t = "";
    for (const i of types) {
        t += `<option value="${i}">${i}</option>`;
    }
    格式El.innerHTML = t;
}

const clipPath: string[] = [];
let isClipRun = false;
/** 获取要切割的视频和位置 */
async function clip() {
    if (isClipRun) return;
    isClipRun = true;
    const start = tStartEl.value;
    const end = tEndEl.value;
    const startV = getTimeInV(start);
    const endV = getTimeInV(end);
    const output1 = path.join(tmpPath, "output1");
    try {
        fs.rmSync(output1, { recursive: true });
    } catch (error) {}
    fs.mkdirSync(output1);
    function toArg(
        v: number,
        t: number,
        a: "start" | "end" | "both",
        t2?: number,
    ) {
        const args = [];
        args.push("-i", path.join(output, `${v}.${type}`));
        if (a === "start") {
            args.push("-ss", t / 1000);
        } else if (a === "end") {
            args.push("-to", t / 1000);
        } else {
            args.push("-ss", t / 1000, "-to", t2 / 1000);
        }
        args.push(path.join(output1, `${v}.${type}`));
        return args;
    }
    if (startV.v + 1 < endV.v) {
        for (let i = startV.v + 1; i < endV.v; i++) {
            fs.copyFileSync(
                path.join(output, `${i}.${type}`),
                path.join(output1, `${i}.${type}`),
            );
        }
    }
    for (let i = startV.v; i <= endV.v; i++) {
        clipPath.push(
            path
                .join(output1, `${i}.${type}`)
                .replaceAll(path.sep, path.posix.sep),
        );
    }
    if (startV.v === endV.v) {
        await runFfmpeg(
            "clip",
            0,
            toArg(startV.v, startV.time, "both", endV.time),
        );
    } else {
        await Promise.all([
            runFfmpeg("clip", 0, toArg(startV.v, startV.time, "start")),
            runFfmpeg("clip", 1, toArg(endV.v, endV.time, "end")),
        ]);
    }
}

function joinAndSave(filepath: string) {
    if (clipPath.length === 1) {
        fs.cpSync(clipPath[0], filepath);
        ffprocess.join[0] = { args: [], finish: "ok", logs: [], testCom: "" };
        updataPrEl(ffprocess);
        return;
    }
    const args = [];

    // 针对不同格式的合并（用switch还要加上作用域的话缩进就太多了）
    if (type === "gif") {
        for (const i of clipPath) {
            args.push("-i", i);
        }
        args.push("-filter_complex");
        let t = "";
        for (const i in clipPath) {
            t += `[${i}:v:0]`;
        }
        t += `concat=n=${clipPath.length}:v=1[outv]`;
        args.push(`"${t}"`, "-map", '"[outv]"');
    } else if (
        type === "webm" ||
        type === "mp4" ||
        type === "ts" ||
        type === "mkv" ||
        type === "mov" ||
        type === "flv" ||
        type === "mpeg"
    ) {
        let t = "";
        for (const i of clipPath) {
            t += `file ${i}\n`;
        }
        const textPath = path.join(tmpPath, "output1", "x.txt");
        fs.writeFileSync(textPath, t);
        args.push("-f", "concat", "-safe", "0", "-i", textPath, "-c", "copy");
    } else if (type === "avi") {
    }
    args.push(filepath);

    runFfmpeg("join", 0, args);
}

async function save() {
    store.set("录屏.转换.格式", 格式El.value);
    ipcRenderer.send("record", "ff", { 格式: type });
}

document.getElementById("save").onclick = save;

const logText = <HTMLTextAreaElement>document.getElementById("log");

let savePath = "";
let isTsOk = false;

const prEl = {
    ts: document.getElementById("pr_ts"),
    clip: document.getElementById("pr_clip"),
    join: document.getElementById("pr_join"),
};

const prText = {
    wait: {
        ts: "等待转换",
        clip: "等待裁剪",
        join: "等待合并",
    },
    running: {
        ts: "正在转换",
        clip: "正在裁剪",
        join: "正在合并",
    },
    ok: {
        ts: "转换完成",
        clip: "裁剪完成",
        join: "合并完成",
    },
    error: {
        ts: "转换失败",
        clip: "裁剪失败",
        join: "合并失败",
    },
};

for (const i in prText) {
    for (const j in prText[i]) {
        prText[i][j] = t(prText[i][j]);
    }
}

function setFFState(type: keyof typeof prEl, n: number, state: prst) {
    ffprocess[type][n].finish = state;
    if (
        type === "ts" &&
        Object.values(ffprocess[type]).every((i) => i.finish === "ok")
    ) {
        if (savePath) {
            clip()
                .then(() => joinAndSave(savePath))
                .catch(() => {
                    isClipRun = false;
                });
        }
    }
}

function updataPrEl(pr: typeof ffprocess) {
    for (const i in pr) {
        const key = i as "ts" | "clip" | "join";
        const prILen = Object.keys(pr[key]).length;
        if (prILen === 0) {
            prEl[key].innerText = `${prText.wait[key]}`;
        } else {
            const stI: { [key in prst]: number } = {
                ok: 0,
                err: 0,
                running: 0,
            };
            for (const j in pr[key]) {
                stI[pr[key][j].finish]++;
            }
            if (stI.err > 0) {
                prEl[key].innerText = `${prText.error[key]} ${t("点击重试")}`;
                prEl[key].classList.add("pro_error");
                prEl[key].onclick = () => {
                    for (const i in pr[key]) {
                        if (pr[key][i].finish === "err") {
                            runFfmpeg(key, Number(i), pr[key][i].args);
                        }
                    }
                    logText.value += "\n\n重试\n\n";
                };
                document.getElementById("log_p").classList.remove("hide_log");
                for (const i in pr[key]) {
                    if (pr[key][i].finish === "err") {
                        logText.value += `\n命令：\n${pr[key][i].testCom}\n\n输出：\n${pr[key][i].logs.map((i) => i.text).join("\n")}`;
                    }
                }
                logText.scrollTop = logText.scrollHeight;
            } else if (stI.ok === prILen) {
                prEl[key].innerText = `${prText.ok[key]}`;
                prEl[key].style.width = "100%";
                prEl[key].classList.add("pro_ok");
                if (key === "ts") {
                    isTsOk = true;
                    if (!savePath) {
                        prEl[key].innerText += ` ${t("等待保存")}`;
                    }
                }
            } else {
                prEl[key].innerText =
                    `${prText.running[key]} ${stI.running}/${prILen}`;
                prEl[key].style.width = `${(stI.running / prILen) * 100}%`;
                prEl[key].classList.add("pro_running");
            }
        }
    }
}

type prst = "ok" | "err" | "running";

type p = {
    [k: number]: {
        args: string[];
        testCom: string;
        logs: { text: string }[];
        finish: "ok" | "err" | "running";
    };
};
const ffprocess: {
    [key in "ts" | "clip" | "join"]: p;
} = {
    ts: {},
    clip: {},
    join: {},
};

updataPrEl(ffprocess);

function runFfmpeg(type: "ts" | "clip" | "join", n: number, args: string[]) {
    const ffmpeg = spawn(pathToFfmpeg, args);
    ffprocess[type][n] = {
        args,
        testCom: `ffmpeg ${args.join(" ")}`,
        finish: "running",
        logs: [],
    };
    updataPrEl(ffprocess);
    return new Promise((re, rj) => {
        ffmpeg.on("close", (code) => {
            if (code === 0) {
                setFFState(type, n, "ok");
                updataPrEl(ffprocess);
                console.log(ffprocess);
                re(true);
            } else {
                setFFState(type, n, "err");
                updataPrEl(ffprocess);
                console.log(ffprocess);
                rj(false);
            }
        });
        ffmpeg.stdout.on("data", (data: Uint8Array) => {
            ffprocess[type][n].logs.push({ text: data.toString() });
            console.log(data.toString());
        });
        ffmpeg.stderr.on("data", (data: Uint8Array) => {
            ffprocess[type][n].logs.push({ text: data.toString() });
            console.log(data.toString());
        });
    });
}
