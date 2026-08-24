"""
Pilot render for "An Introduction to Gyrokinetics".
Covers: cold-open tokamak image, and Section 2 (single particle in a magnetic field).
No audio. Silent visual track only.

Render with, e.g.:
    python -m manim -qm gyrokinetics_pilot.py TokamakColdOpen
    python -m manim -qm gyrokinetics_pilot.py SingleParticleGyration
"""
from manim import *
import os

ASSET_DIR = os.path.join(os.path.dirname(__file__), "..", "assets")

PARALLEL_COLOR = TEAL
PERP_COLOR = ORANGE
FIELD_COLOR = GREY_B
BG_COLOR = "#0e0e12"

config.background_color = BG_COLOR


class TokamakColdOpen(Scene):
    def construct(self):
        img_path = os.path.join(ASSET_DIR, "alcator_cmod_interior.jpg")
        photo = ImageMobject(img_path)
        photo.scale_to_fit_width(config.frame_width)
        photo.set_opacity(0)

        caption = Text(
            "Alcator C-Mod tokamak, interior",
            font_size=28,
            color=WHITE,
        ).to_edge(DOWN, buff=0.4)
        attribution = Text(
            "Photo: Mike Garrett, MIT PSFC — CC BY 3.0",
            font_size=20,
            color=GREY_B,
        ).next_to(caption, DOWN, buff=0.15)

        self.play(photo.animate.set_opacity(1), run_time=2.0)
        self.play(FadeIn(caption, shift=UP * 0.2), FadeIn(attribution))
        self.wait(1.5)

        # slow push-in, evokes the "camera drifting across the machine" cold open beat
        self.play(
            photo.animate.scale(1.15).shift(LEFT * 0.3),
            run_time=4.0,
            rate_func=linear,
        )
        self.wait(0.5)

        hook_line = Text(
            "Inside, the plasma is never still.",
            font_size=36,
            color=WHITE,
        ).to_edge(UP, buff=0.6)
        hook_line.add_background_rectangle(color=BLACK, opacity=0.55, buff=0.15)

        self.play(FadeIn(hook_line, shift=DOWN * 0.2))
        self.wait(2)

        self.play(
            *[FadeOut(m) for m in self.mobjects],
            run_time=1.2,
        )
        self.wait(0.3)


class SingleParticleGyration(ThreeDScene):
    def construct(self):
        # ---- Part A: set up field and Lorentz force equation (2D, camera-fixed) ----
        title = Text("A single particle in a magnetic field", font_size=34)
        title.to_edge(UP, buff=0.5)
        self.add_fixed_in_frame_mobjects(title)
        title.set_opacity(0)
        self.play(title.animate.set_opacity(1), run_time=1.0)
        self.wait(0.5)

        lorentz = MathTex(
            r"m\dot{\mathbf{v}} = q\,\mathbf{v}\times\mathbf{B}",
            font_size=52,
        )
        self.add_fixed_in_frame_mobjects(lorentz)
        lorentz.move_to(UP * 1.0)
        lorentz.set_opacity(0)
        self.play(Write(lorentz.set_opacity(1)), run_time=2.5)
        self.wait(1.0)

        self.play(FadeOut(title), run_time=0.8)
        self.play(lorentz.animate.scale(0.7).to_corner(UL, buff=0.4), run_time=1.2)

        # ---- Part B: 2D orbit in the viewing plane, perpendicular decomposition ----
        self.set_camera_orientation(phi=0, theta=-90 * DEGREES)

        field_dots = VGroup(
            *[
                Dot(radius=0.03, color=FIELD_COLOR).move_to(
                    np.array([x, y, 0])
                )
                for x in np.arange(-6, 6.5, 1.0)
                for y in np.arange(-3, 3.5, 1.0)
            ]
        )
        field_label = Text("B field, out of the page", font_size=24, color=FIELD_COLOR)
        self.add_fixed_in_frame_mobjects(field_label)
        field_label.to_corner(UR, buff=0.4).set_opacity(0)

        self.play(
            LaggedStart(*[FadeIn(d) for d in field_dots], lag_ratio=0.01),
            field_label.animate.set_opacity(1),
            run_time=2.0,
        )
        self.wait(0.5)

        radius = 1.4
        center = ORIGIN
        orbit = Circle(radius=radius, color=PERP_COLOR).move_to(center)

        theta_tracker = ValueTracker(0)

        def particle_pos():
            th = theta_tracker.get_value()
            return center + radius * np.array([np.cos(th), np.sin(th), 0])

        particle = Dot(color=WHITE, radius=0.09)
        particle.add_updater(lambda m: m.move_to(particle_pos()))

        v_perp_vec = always_redraw(
            lambda: Arrow(
                start=particle_pos(),
                end=particle_pos()
                + 1.1
                * np.array(
                    [
                        -np.sin(theta_tracker.get_value()),
                        np.cos(theta_tracker.get_value()),
                        0,
                    ]
                ),
                color=PERP_COLOR,
                buff=0,
                stroke_width=5,
                max_tip_length_to_length_ratio=0.25,
            )
        )
        v_perp_label = MathTex(r"v_\perp", color=PERP_COLOR, font_size=36)
        v_perp_label.add_updater(
            lambda m: m.next_to(v_perp_vec, direction=v_perp_vec.get_vector(), buff=0.15)
        )

        self.play(Create(orbit), run_time=1.0)
        self.play(FadeIn(particle), GrowArrow(v_perp_vec), FadeIn(v_perp_label))
        self.wait(0.3)

        self.play(
            theta_tracker.animate.increment_value(2 * PI),
            run_time=4.0,
            rate_func=linear,
        )
        self.wait(0.5)

        cyclotron_eq = MathTex(
            r"\Omega_c = \frac{qB}{m}",
            font_size=44,
        )
        self.add_fixed_in_frame_mobjects(cyclotron_eq)
        cyclotron_eq.next_to(lorentz, DOWN, buff=0.5, aligned_edge=LEFT).set_opacity(0)
        self.play(Write(cyclotron_eq.set_opacity(1)), run_time=2.0)
        self.wait(0.5)

        larmor_eq = MathTex(
            r"\rho = \frac{v_\perp}{\Omega_c} = \frac{m v_\perp}{qB}",
            font_size=44,
        )
        self.add_fixed_in_frame_mobjects(larmor_eq)
        larmor_eq.next_to(cyclotron_eq, DOWN, buff=0.4, aligned_edge=LEFT).set_opacity(0)
        larmor_eq.set_color_by_tex(r"\rho", PERP_COLOR)
        self.play(Write(larmor_eq.set_opacity(1)), run_time=2.5)
        self.wait(1.0)

        # brief scale comparison: electron vs deuteron Larmor radius
        self.play(
            theta_tracker.animate.increment_value(2 * PI),
            run_time=3.0,
            rate_func=linear,
        )

        scale_title = Text("Larmor radius at 5 T", font_size=28)
        self.add_fixed_in_frame_mobjects(scale_title)
        scale_title.to_edge(DOWN, buff=2.3).set_opacity(0)

        electron_circle = Circle(radius=0.03, color=PERP_COLOR, fill_opacity=0.6)
        deuteron_circle = Circle(radius=0.25, color=PERP_COLOR, fill_opacity=0.6)
        e_label = Text("electron: ~0.05 mm", font_size=22)
        d_label = Text("deuteron: ~3 mm", font_size=22)
        e_group = VGroup(electron_circle, e_label).arrange(DOWN, buff=0.2)
        d_group = VGroup(deuteron_circle, d_label).arrange(DOWN, buff=0.2)
        compare_group = VGroup(e_group, d_group).arrange(RIGHT, buff=1.0, aligned_edge=DOWN)
        compare_group.to_edge(DOWN, buff=0.6)
        self.add_fixed_in_frame_mobjects(e_label, d_label)
        e_label.set_opacity(0)
        d_label.set_opacity(0)

        self.play(
            scale_title.animate.set_opacity(1),
            FadeIn(electron_circle),
            FadeIn(deuteron_circle),
            e_label.animate.set_opacity(1),
            d_label.animate.set_opacity(1),
            run_time=1.5,
        )
        self.wait(2.0)

        self.play(
            *[FadeOut(m) for m in self.mobjects if m not in [particle, orbit]],
            FadeOut(particle),
            FadeOut(orbit),
            FadeOut(field_dots),
            run_time=1.0,
        )
        v_perp_vec.clear_updaters()
        v_perp_label.clear_updaters()
        particle.clear_updaters()

        # ---- Part C: pull back into 3D to reveal the full helix ----
        helix_title = Text("Add a parallel drift: the full trajectory is a helix", font_size=30)
        self.add_fixed_in_frame_mobjects(helix_title)
        helix_title.to_edge(UP, buff=0.5).set_opacity(0)
        self.play(helix_title.animate.set_opacity(1), run_time=1.0)

        self.move_camera(phi=65 * DEGREES, theta=-60 * DEGREES, run_time=2.5)

        axes = ThreeDAxes(
            x_range=[-3, 3, 1],
            y_range=[-3, 3, 1],
            z_range=[-1, 6, 1],
            x_length=5,
            y_length=5,
            z_length=6,
        )

        def helix_point(t):
            r = 1.0
            pitch = 0.5
            return np.array([r * np.cos(t), r * np.sin(t), pitch * t])

        helix = ParametricFunction(
            helix_point,
            t_range=[0, 6 * PI],
            color=PERP_COLOR,
            stroke_width=4,
        )
        guiding_center_line = Line(
            start=np.array([0, 0, 0]),
            end=np.array([0, 0, 0.5 * 6 * PI]),
            color=PARALLEL_COLOR,
            stroke_width=5,
        )
        gc_label = MathTex(r"\mathbf{R}", color=PARALLEL_COLOR, font_size=40)
        gc_label.rotate(PI / 2, axis=RIGHT)
        gc_label.move_to(guiding_center_line.get_end() + np.array([0.6, 0, 0]))

        self.play(Create(axes), run_time=1.0)
        self.play(Create(helix), run_time=3.5, rate_func=linear)
        self.play(Create(guiding_center_line), Write(gc_label), run_time=1.5)
        self.wait(1.0)

        self.begin_ambient_camera_rotation(rate=0.15)
        self.wait(4.0)
        self.stop_ambient_camera_rotation()

        self.wait(1.0)
