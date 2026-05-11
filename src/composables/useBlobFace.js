import { computed, ref, onBeforeUnmount, onMounted } from "vue";
import { interpolate, interpolateAll } from "flubber";

const VIEWBOX = { width: 363, height: 180 };

import eyesDefaultRaw from "../assets/face/eyes_default.svg?raw";
import eyesHappyRaw from "../assets/face/eyes_happy.svg?raw";
import eyesNeutralRaw from "../assets/face/eyes_neutral.svg?raw";
import eyesSadRaw from "../assets/face/eyes_sad.svg?raw";
import eyesAngryRaw from "../assets/face/eyes_angry.svg?raw";
import eyesSurprisedRaw from "../assets/face/eyes_surprised.svg?raw";
import eyesClosedRaw from "../assets/face/eyes_closed.svg?raw";

import mouthDefaultRaw from "../assets/face/mouth_default.svg?raw";
import mouthHappyRaw from "../assets/face/mouth_happy.svg?raw";
import mouthNeutralRaw from "../assets/face/mouth_neutral.svg?raw";
import mouthSadRaw from "../assets/face/mouth_sad.svg?raw";
import mouthAngryRaw from "../assets/face/mouth_angry.svg?raw";
import mouthSurprisedRaw from "../assets/face/mouth_surprised.svg?raw";

const extractPathsFromSvg = (raw, targetBox) => {
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(raw, "image/svg+xml");
        const numberRegex = /-?\d*\.?\d+(?:e[-+]?\d+)?/gi;

        const parseMatrix = (value) => {
            const match = value?.match?.(/matrix\(([-0-9eE.,\s]+)\)/);
            if (!match) return [1, 0, 0, 1, 0, 0];
            const parts = match[1].split(/[,\s]+/).map(Number);
            return parts.length >= 6 ? parts.slice(0, 6) : [1, 0, 0, 1, 0, 0];
        };

        const multiply = (left, right) => ([
            left[0] * right[0] + left[2] * right[1],
            left[1] * right[0] + left[3] * right[1],
            left[0] * right[2] + left[2] * right[3],
            left[1] * right[2] + left[3] * right[3],
            left[0] * right[4] + left[2] * right[5] + left[4],
            left[1] * right[4] + left[3] * right[5] + left[5],
        ]);

        const transformPath = (path, matrix) => {
            const numbers = path.match(numberRegex)?.map(Number) || [];
            if (numbers.length === 0) return path;

            const transformed = [];
            for (let index = 0; index < numbers.length; index += 2) {
                const x = numbers[index];
                const y = numbers[index + 1];
                transformed.push(
                    matrix[0] * x + matrix[2] * y + matrix[4],
                    matrix[1] * x + matrix[3] * y + matrix[5]
                );
            }

            let outputIndex = 0;
            return path.replace(numberRegex, () => String(Math.round(transformed[outputIndex++] * 1000) / 1000));
        };

        const transformedPaths = Array.from(doc.querySelectorAll("path")).map((pathElement) => {
            let current = pathElement;
            let matrix = [1, 0, 0, 1, 0, 0];

            while (current && current.nodeName && current.nodeName.toLowerCase() !== "svg") {
                if (current.getAttribute?.("transform")) {
                    matrix = multiply(parseMatrix(current.getAttribute("transform")), matrix);
                }
                current = current.parentNode;
            }

            return transformPath(pathElement.getAttribute("d") || "", matrix);
        });

        if (!targetBox || transformedPaths.length === 0) {
            return transformedPaths;
        }

        const coords = transformedPaths.flatMap((path) => path.match(numberRegex)?.map(Number) || []);
        if (coords.length < 2) {
            return transformedPaths;
        }

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        for (let index = 0; index < coords.length; index += 2) {
            const x = coords[index];
            const y = coords[index + 1];
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
        }

        if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minY) || !Number.isFinite(maxY)) {
            return transformedPaths;
        }

        const sourceCenterX = (minX + maxX) / 2;
        const sourceCenterY = (minY + maxY) / 2;
        const targetCenterX = targetBox.width / 2;
        const targetCenterY = targetBox.height / 2;
        const shiftX = targetCenterX - sourceCenterX;
        const shiftY = targetCenterY - sourceCenterY;

        return transformedPaths.map((path) => {
            let coordIndex = 0;
            return path.replace(numberRegex, (match) => {
                const value = Number(match);
                const shifted = coordIndex % 2 === 0 ? value + shiftX : value + shiftY;
                coordIndex += 1;
                return String(Math.round(shifted * 1000) / 1000);
            });
        });
    } catch {
        return [];
    }
};

const shiftPathsY = (paths, deltaY) => {
    const numberRegex = /-?\d*\.?\d+(?:e[-+]?\d+)?/gi;
    return paths.map((path) => {
        let coordIndex = 0;
        return path.replace(numberRegex, (match) => {
            const value = Number(match);
            const shifted = coordIndex % 2 === 0 ? value : value + deltaY;
            coordIndex += 1;
            return String(Math.round(shifted * 1000) / 1000);
        });
    });
};

const FACE_PRESETS = {
    default: {
        eyes: extractPathsFromSvg(eyesDefaultRaw, VIEWBOX),
        mouth: shiftPathsY(extractPathsFromSvg(mouthDefaultRaw, VIEWBOX), 30),
    },
    happy: {
        eyes: extractPathsFromSvg(eyesHappyRaw, VIEWBOX),
        mouth: shiftPathsY(extractPathsFromSvg(mouthHappyRaw, VIEWBOX), 40),
    },
    neutral: {
        eyes: extractPathsFromSvg(eyesNeutralRaw, VIEWBOX),
        mouth: extractPathsFromSvg(mouthNeutralRaw, VIEWBOX),
    },
    sad: {
        eyes: extractPathsFromSvg(eyesSadRaw, VIEWBOX),
        mouth: extractPathsFromSvg(mouthSadRaw, VIEWBOX),
    },
    angry: {
        eyes: extractPathsFromSvg(eyesAngryRaw, VIEWBOX),
        mouth: extractPathsFromSvg(mouthAngryRaw, VIEWBOX),
    },
    surprised: {
        eyes: extractPathsFromSvg(eyesSurprisedRaw, VIEWBOX),
        mouth: extractPathsFromSvg(mouthSurprisedRaw, VIEWBOX),
    },
};

const CLOSED_EYES = extractPathsFromSvg(eyesClosedRaw, VIEWBOX);

const EMOTION_FACE_PRESETS = {
    excited: "happy",
    content: "default",
    anxious: "neutral",
    sad: "sad",
    angry: "angry",
};

export const FACE_PRESET_KEYS = Object.keys(FACE_PRESETS);

export const useBlobFace = () => {
    const eyesPaths = ref(FACE_PRESETS.default.eyes);
    const mouthPaths = ref(FACE_PRESETS.default.mouth);

    let faceEyesFrameId;
    let faceMouthFrameId;
    let blinkAnimationFrameId;
    let blinkTimeoutId;
    let isBlinking = false;
    let currentPresetName = "default";
    let followFrameId;
    let isFollowing = false;
    let followGetter = null;
    let followPreviousPreset = null;
    let followBaseEyes = null;
    const eyesOffset = ref({ x: 0, y: 0 });

    const stopAnimation = () => {
        if (faceEyesFrameId) {
            window.cancelAnimationFrame(faceEyesFrameId);
            faceEyesFrameId = undefined;
        }
        if (faceMouthFrameId) {
            window.cancelAnimationFrame(faceMouthFrameId);
            faceMouthFrameId = undefined;
        }
    };

    const stopBlinkAnimation = () => {
        if (blinkAnimationFrameId) {
            window.cancelAnimationFrame(blinkAnimationFrameId);
            blinkAnimationFrameId = undefined;
        }
        isBlinking = false;
    };

    const stopBlinkScheduler = () => {
        if (blinkTimeoutId) {
            window.clearTimeout(blinkTimeoutId);
            blinkTimeoutId = undefined;
        }
    };

    const randomBlinkDelay = () => {
        return Math.floor(Math.random() * 5000) + 5000;
    };

    const animateEyes = (fromEyes, toEyes, duration, target = "face", onComplete) => {
        const eyesInterpolator = interpolateAll(fromEyes, toEyes, { string: true, maxSegmentLength: 8 });
        const start = performance.now();

        const tick = (now) => {
            const progress = Math.min(1, (now - start) / duration);

            if (typeof eyesInterpolator === "function") {
                eyesPaths.value = eyesInterpolator(progress);
            } else if (Array.isArray(eyesInterpolator)) {
                eyesPaths.value = eyesInterpolator.map((fn) => (typeof fn === "function" ? fn(progress) : fn));
            }

            if (progress < 1) {
                const id = window.requestAnimationFrame(tick);
                if (target === "blink") blinkAnimationFrameId = id; else faceEyesFrameId = id;
                return;
            }

            if (target === "blink") blinkAnimationFrameId = undefined; else faceEyesFrameId = undefined;
            if (typeof onComplete === "function") onComplete();
        };

        const id = window.requestAnimationFrame(tick);
        if (target === "blink") blinkAnimationFrameId = id; else faceEyesFrameId = id;
    };

    const scheduleNextBlink = () => {
        stopBlinkScheduler();
        blinkTimeoutId = window.setTimeout(() => {
            if (isBlinking || CLOSED_EYES.length === 0 || eyesPaths.value.length !== CLOSED_EYES.length) {
                scheduleNextBlink();
                return;
            }

            const openEyes = [...eyesPaths.value];
            isBlinking = true;

            animateEyes(openEyes, CLOSED_EYES, 100, "blink", () => {
                animateEyes(CLOSED_EYES, openEyes, 120, "blink", () => {
                    isBlinking = false;
                    scheduleNextBlink();
                });
            });
        }, randomBlinkDelay());
    };

    const animateMouth = (fromMouth, toMouth, duration, onComplete) => {
        const mouthInterpolator = interpolateAll(fromMouth, toMouth, { string: true, maxSegmentLength: 8 });
        const start = performance.now();

        const tick = (now) => {
            const progress = Math.min(1, (now - start) / duration);

            if (typeof mouthInterpolator === "function") {
                mouthPaths.value = mouthInterpolator(progress);
            } else if (Array.isArray(mouthInterpolator)) {
                mouthPaths.value = mouthInterpolator.map((fn) => (typeof fn === "function" ? fn(progress) : fn));
            }

            if (progress < 1) {
                faceMouthFrameId = window.requestAnimationFrame(tick);
            } else {
                faceMouthFrameId = undefined;
                if (typeof onComplete === "function") onComplete();
            }
        };

        faceMouthFrameId = window.requestAnimationFrame(tick);
    };

    const animateFace = ({ eyes, mouth }) => {
        stopAnimation();
        animateEyes(eyesPaths.value, eyes, 300, "face");
        animateMouth(mouthPaths.value, mouth, 300);
    };

    const startEyeFollow = (getOffset) => {
        if (isFollowing || typeof getOffset !== "function") return;
        isFollowing = true;
        followBaseEyes = FACE_PRESETS.surprised.eyes;
        followPreviousPreset = currentPresetName || "default";
        setFace("surprised");

        const loop = () => {
            if (!isFollowing) return;
            const offset = getOffset() || { x: 0, y: 0 };
            const MAX_RADIUS = 12;
            const distance = Math.hypot(offset.x, offset.y);
            const scale = distance > 0 ? Math.min(1, 1 / distance) : 0;
            const dx = offset.x * scale * MAX_RADIUS;
            const dy = offset.y * scale * MAX_RADIUS;
            eyesOffset.value = { x: dx, y: dy };
            followFrameId = window.requestAnimationFrame(loop);
        };

        followFrameId = window.requestAnimationFrame(loop);
    };

    const stopEyeFollow = () => {
        if (followFrameId) {
            window.cancelAnimationFrame(followFrameId);
            followFrameId = undefined;
        }
        isFollowing = false;
        followGetter = null;
        eyesOffset.value = { x: 0, y: 0 };
        setFace(followPreviousPreset || "default");
        followPreviousPreset = null;
    };

    const setFace = (nextFace) => {
        if (nextFace in EMOTION_FACE_PRESETS) {
            nextFace = EMOTION_FACE_PRESETS[nextFace];
        }
        if (!FACE_PRESETS[nextFace]) {
            nextFace = "default";
        }

        stopBlinkAnimation();
        currentPresetName = nextFace;
        const target = FACE_PRESETS[nextFace];
        animateFace(target);
        scheduleNextBlink();
    };

    const faceParts = computed(() => ({
        eyes: eyesPaths.value,
        mouth: mouthPaths.value,
    }));

    onMounted(() => {
        scheduleNextBlink();
    });

    onBeforeUnmount(() => {
        stopAnimation();
        stopBlinkAnimation();
        stopBlinkScheduler();
    });

    return {
        faceParts,
        setFace,
        startEyeFollow,
        stopEyeFollow,
        eyesOffset,
    };
};
