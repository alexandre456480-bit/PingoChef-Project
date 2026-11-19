"""Render the landing animation and poster from the original clip in img/landing_page."""

from pathlib import Path
import subprocess

import cv2
import imageio_ffmpeg
import numpy as np
from PIL import Image


def remove_background(rgb):
    """Key only pale pixels connected to the exterior of the illustration."""
    minimum = rgb.min(axis=2)
    maximum = rgb.max(axis=2)
    chroma = maximum - minimum
    pale = (minimum > 183) & (chroma < 34)
    _, labels = cv2.connectedComponents(pale.astype(np.uint8), connectivity=4)
    boundary = np.unique(np.concatenate((labels[0], labels[-1], labels[:, 0], labels[:, -1])))
    exterior = np.isin(labels, boundary[boundary != 0])

    rgb = rgb.astype(np.float32)
    background = np.median(np.concatenate((rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1])), axis=0)
    luminance_loss = (background - rgb).mean(axis=2)
    warm_glow = rgb[:, :, 0] - rgb[:, :, 2] - (background[0] - background[2])
    edge_alpha = np.clip((luminance_loss - 9) / 150 + np.maximum(warm_glow - 9, 0) / 52, 0, 1)
    alpha = np.where(exterior, edge_alpha, 1)[..., None]
    color = np.clip((rgb - (1 - alpha) * background) / np.maximum(alpha, 0.01), 0, 255)
    color[alpha[..., 0] < 1 / 255] = 0
    return np.concatenate((color, alpha * 255), axis=2).astype(np.uint8)


def main():
    frontend = Path(__file__).resolve().parents[1]
    source = frontend.parent / "img" / "landing_page" / "animation_sessao4.mp4"
    landing = frontend / "public" / "landing"
    width, height = 540, 960
    frames = imageio_ffmpeg.read_frames(
        str(source), pix_fmt="rgb24", output_params=["-vf", f"scale={width}:{height}"]
    )
    metadata = next(frames)
    command = [
        imageio_ffmpeg.get_ffmpeg_exe(), "-loglevel", "error", "-y",
        "-f", "rawvideo", "-pix_fmt", "rgba", "-s", f"{width}x{height}",
        "-r", str(metadata["fps"]), "-i", "-", "-an", "-c:v", "libvpx-vp9",
        "-pix_fmt", "yuva420p", "-crf", "24", "-b:v", "0", "-auto-alt-ref", "0",
        "-row-mt", "1", str(landing / "animation-sessao-4.webm"),
    ]
    try:
        with subprocess.Popen(command, stdin=subprocess.PIPE) as encoder:
            for index, frame in enumerate(frames):
                rgb = np.frombuffer(frame, np.uint8).reshape(height, width, 3)
                rgba = remove_background(rgb)
                if index == 0:
                    Image.fromarray(rgba).save(landing / "animation-sessao-4-poster.webp", quality=90)
                encoder.stdin.write(rgba.tobytes())
            encoder.stdin.close()
            if encoder.wait() != 0:
                raise RuntimeError("VP9 alpha encode failed")
    finally:
        frames.close()


if __name__ == "__main__":
    main()
