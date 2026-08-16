import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from PIL import Image
import numpy as np
import os

DIR = "assets/images/neurochemistry"

CAPTION_COLOR = "#5F6368"
CROP_MARGIN = 6     # keep this many px below the detected border row when cropping
GAP = 32             # gap between box border and new caption baseline area
CAPTION_BAND_H = 30  # vertical space reserved for the caption text itself
BOTTOM_MARGIN = 22   # whitespace below the caption before the image edge
FONT_SIZE = 15.5

ITEMS = [
    ("MDMA seratonin.png", 652,
     "MDMA reverses SERT, flooding the cleft with serotonin."),
    ("MDMA seratonin and dopamine.png", 651,
     "Serotonin release dominates MDMA's acute profile; dopamine/norepinephrine add stimulation."),
    ("CocaineDAT.png", 652,
     "Blocking reuptake prolongs dopamine's presence in the synaptic cleft."),
    ("CocaineDATsimple.png", 652,
     "Blocking reuptake prolongs dopamine's presence in the synaptic cleft."),
    ("SSRI mechanism.png", 634,
     "Blocking reuptake raises extracellular serotonin; therapeutic benefit builds over weeks."),
    ("AlcoholOnGABA.png", 560,
     "Ethanol potentiates GABA-A receptor function, increasing inhibitory Cl− flux."),
    ("BenzoMechanism.png", 572,
     "Benzodiazepines are positive allosteric modulators — they require GABA to act, unlike barbiturates."),
    ("PCPmechanism.png", 591,
     "Occupying the open channel pore prevents Ca2+ influx despite glutamate binding."),
    ("SERT.png", 622,
     "Reuptake via SERT terminates serotonergic signalling under normal conditions."),
    ("nicotinic acetylcholine.png", 622,
     "Agonist binding opens the channel directly, rapidly depolarising the neuron."),
    ("GABBA receptor.png", 560,
     "Ethanol potentiates GABA-A receptor function, increasing inhibitory Cl− flux."),
]

def render_caption_rgba(width_px, height_px, text, dpi=100):
    fig = plt.figure(figsize=(width_px / dpi, height_px / dpi), dpi=dpi)
    fig.patch.set_alpha(0)
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis("off")
    ax.text(0.5, 0.5, text, ha="center", va="center", fontsize=FONT_SIZE,
             style="italic", color=CAPTION_COLOR, family="sans-serif")
    fig.canvas.draw()
    buf = np.asarray(fig.canvas.buffer_rgba())
    plt.close(fig)
    return Image.fromarray(buf, mode="RGBA")

for fname, box_bottom, caption in ITEMS:
    path = os.path.join(DIR, fname)
    im = Image.open(path).convert("RGB")
    w, h = im.size

    crop_h = box_bottom + CROP_MARGIN
    tail_h = GAP + CAPTION_BAND_H + BOTTOM_MARGIN
    new_h = crop_h + tail_h

    cropped = im.crop((0, 0, w, crop_h))
    canvas = Image.new("RGB", (w, new_h), (255, 255, 255))
    canvas.paste(cropped, (0, 0))

    cap_img = render_caption_rgba(w, CAPTION_BAND_H, caption)
    cap_y = crop_h + GAP
    canvas.paste(cap_img, (0, cap_y), cap_img)

    canvas.save(path)
    print(f"fixed {fname}: {w}x{h} -> {w}x{new_h}")
