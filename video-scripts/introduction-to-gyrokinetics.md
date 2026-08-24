# An Introduction to Gyrokinetics

Format target: long-form solo physics explainer, in the register of Richard Behiel's channel (unhurried pacing, full derivations left on screen, Manim-style geometric animation carrying the intuition while the narration carries the argument). Estimated runtime 24–28 minutes. Visual directions are in `[brackets]`; they assume Manim scenes but read fine as a blocking guide for any animation tool.

---

## Cold open — 0:00

**[VISUAL: A tokamak cutaway, slowly rotating. Cut to simulated turbulence eddies rippling across the plasma cross-section, colour-mapped density fluctuations. Hold for a few seconds before any narration.]**

Inside a tokamak, the plasma is never still. Turbulent eddies a few millimetres across churn through a machine metres wide, and they are the single biggest reason fusion power stations are hard to build. Not the temperature, not the confinement fields on their own, but the fact that turbulence quietly leaks heat out of the plasma faster than any smooth theory predicts.

**[VISUAL: Zoom out from the eddies to reveal the full machine, then to a schematic of ITER.]**

If you want to design a reactor, you need to predict that leakage. And to predict it, you need to simulate the plasma. This is where the trouble starts, because a plasma is not one fluid, it is on the order of $10^{20}$ individual charged particles, each one responding to the electric and magnetic fields that all the others are creating at the same time.

**[VISUAL: Text card: "6-dimensional phase space per particle species."]**

Simulating that directly means tracking a distribution function over six dimensions, three of position and three of velocity, evolving in time. That's the full kinetic description, and it is exact. It is also, for a reactor-scale plasma, computationally impossible.

This video is about the idea that makes it possible anyway: **gyrokinetics**. It is one of the most important pieces of applied mathematics in fusion research, and almost nobody outside plasma physics has heard of it. By the end, you'll understand where it comes from, what it throws away, and why throwing that away is exactly the right thing to do.

---

## Section 1 — Why you can't just simulate the plasma — 1:30

**[VISUAL: Vlasov equation appears, term by term, with plain-English labels floating beside each piece.]**

$$
\frac{\partial f}{\partial t} + \mathbf{v}\cdot\nabla f + \frac{q}{m}(\mathbf{E}+\mathbf{v}\times\mathbf{B})\cdot\nabla_v f = 0
$$

This is the Vlasov equation. $f(\mathbf{x}, \mathbf{v}, t)$ is a distribution function, it tells you the density of particles at a given position and velocity at a given time. The equation says that distribution is simply carried along by the particle trajectories, which are themselves set by the Lorentz force. Couple this to Maxwell's equations, since the particles' motion generates the very fields pushing them around, and you have the complete, self-consistent description of a collisionless plasma.

**[VISUAL: Split screen. Left: a grid representing 3D position space. Right: a grid representing 3D velocity space. A single point moves through both simultaneously.]**

The difficulty is dimensionality. $f$ lives in six-dimensional phase space, not three. Discretise each dimension with even a modest number of grid points, and the total grid size multiplies across all six. Add a separate $f$ for electrons and for every ion species, then add the time dimension needed to resolve the fastest motion in the system, and the computational cost becomes untenable for anything the size of a real reactor.

**[VISUAL: A frequency axis, log scale, with markers: electron cyclotron frequency, ion cyclotron frequency, transit frequency, turbulence frequency, energy confinement time. The gap between the first and last is visually enormous.]**

There's a second problem, which is timescale separation. The fastest motion in a magnetised plasma, the gyration of a charged particle around a field line, happens roughly a billion times faster than the turbulent transport we actually care about predicting. A direct simulation has to resolve the fast motion accurately just to stay numerically stable, even though that fast motion is not, on its own, the physics of interest.

So the question becomes: can we systematically remove the fast, uninteresting motion from the equations, while keeping everything the slow, interesting motion depends on? That is precisely what gyrokinetics does. But to see how, we need to first understand the fast motion properly.

---

## Section 2 — A single particle in a magnetic field — 4:00

**[VISUAL: Empty 3D space. A uniform magnetic field is drawn as a field of parallel arrows pointing "into" the plane, sparse and even. A single positive charge appears with some initial velocity.]**

Forget the plasma for a moment. Consider one charged particle in a uniform magnetic field $\mathbf{B}$, with no electric field yet. The Lorentz force is

$$
m\dot{\mathbf{v}} = q\mathbf{v}\times\mathbf{B}
$$

**[VISUAL: Decompose the velocity vector into a component along B (highlighted in one colour) and a component perpendicular to B (highlighted in another).]**

Split the velocity into a piece parallel to $\mathbf{B}$ and a piece perpendicular to it. The force $\mathbf{v}\times\mathbf{B}$ has no component along $\mathbf{B}$, so the parallel velocity is untouched, the particle simply drifts along the field line at constant speed. All the interesting force acts on the perpendicular component.

**[VISUAL: Animate the perpendicular velocity vector rotating steadily, tracing out a circle. The particle's actual trajectory, a helix, unspools in 3D alongside the parallel drift.]**

For the perpendicular motion, the force is always perpendicular to the velocity itself, which is exactly the condition for uniform circular motion. The particle gyrates around the field line at the **cyclotron frequency**

$$
\Omega_c = \frac{qB}{m}
$$

with a radius, the **Larmor radius**,

$$
\rho = \frac{v_\perp}{\Omega_c} = \frac{m v_\perp}{qB}
$$

**[VISUAL: Compare Larmor radius for an electron versus a deuteron in a 5 tesla field, drawn to scale next to a metre-stick icon. The electron's circle is barely visible; the ion's is millimetre-scale.]**

Put in tokamak numbers and this radius is tiny, typically sub-millimetre for electrons, a few millimetres for ions, against a machine that is metres across. Combine the parallel drift with the perpendicular gyration and the full trajectory is a **helix**, winding along the field line.

This is the fast motion we identified in Section 1. Every particle in the plasma is doing this, all the time, and any honest simulation has to resolve it. The question is whether we actually need to track the *phase* of that gyration, where exactly the particle is on its little circle at any instant, or whether that detail can be averaged away.

---

## Section 3 — The guiding centre and its drifts — 8:00

**[VISUAL: The helix from before, now with a smooth curve drawn through the centre of each loop, the "guiding centre" trajectory, highlighted in a contrasting colour.]**

Here is the key move. Instead of tracking the particle's exact position, track the centre of its gyration circle, called the **guiding centre**. In a perfectly uniform field with no other forces, the guiding centre just sits still while the particle spins around it (plus whatever parallel motion is present). But real fields are never perfectly uniform, and that's where it gets interesting.

**[VISUAL: Introduce a magnetic field with a gradient, drawn as arrows that get denser (stronger) toward one side. The gyration circle is no longer a perfect circle: it's tighter on the strong-field side, wider on the weak-field side.]**

If $B$ varies in space, the Larmor radius varies around the orbit too, since $\rho = m v_\perp/qB$ shrinks where $B$ is strong and grows where $B$ is weak. The orbit is no longer a closed circle: it's slightly egg-shaped, and that asymmetry causes the guiding centre itself to creep sideways, perpendicular to both $\mathbf{B}$ and $\nabla B$. This is the **grad-B drift**:

$$
\mathbf{v}_{\nabla B} = \frac{m v_\perp^2}{2qB^3}\,\mathbf{B}\times\nabla B
$$

**[VISUAL: Field lines curving, as around a tokamak's toroidal axis. Show the centrifugal-like effect on a particle following the parallel motion along the curve.]**

A second drift arises when the field lines themselves are curved rather than straight, since a particle moving along a curved line experiences an effective centrifugal force. That gives the **curvature drift**, with a similar structure and the same characteristic $\mathbf{B}\times(\text{something})$ form.

**[VISUAL: Add a uniform electric field E perpendicular to B. Show the gyration orbit becoming lopsided: faster on one side, slower on the other, again producing a net sideways creep of the guiding centre.]**

A third, if there's a perpendicular electric field, gives the **E cross B drift**,

$$
\mathbf{v}_{E\times B} = \frac{\mathbf{E}\times\mathbf{B}}{B^2}
$$

which, notably, is the same for every particle regardless of charge or mass. It's this drift that dominates turbulent transport in tokamaks, because turbulent electric fields push the entire plasma around together.

**[VISUAL: Side-by-side comparison: the full helical trajectory (fast, complicated) versus the guiding centre trajectory alone (slow, smooth curve made of the sum of these drifts).]**

Notice the pattern. In every case, the fast gyration is still happening, but the quantity we actually care about for transport, where the *guiding centre* ends up, evolves slowly and smoothly. If we could write equations of motion purely for the guiding centre, ignoring the gyration phase entirely, we'd have exactly the reduction we're after. That is the gyrokinetic programme, and the tool that gets us there is averaging.

---

## Section 4 — Gyroaveraging: throwing away the phase — 12:00

**[VISUAL: The gyration circle again, with an angle θ, the "gyrophase," marked explicitly as the particle's position on the circle.]**

Decompose a particle's velocity into three pieces instead of two: the parallel velocity $v_\parallel$, the perpendicular speed $v_\perp$, and the **gyrophase** $\theta$, the angle telling you exactly where on the gyration circle the particle currently sits.

Of these three, $\theta$ is almost pure bookkeeping. It cycles around at the cyclotron frequency, contains no information about transport, and yet in the full 6D kinetic description it's one of our coordinates, forcing us to resolve motion on the fast cyclotron timescale. The claim we want to justify is that we can *average over* $\theta$, replacing the exact distribution function with one that no longer depends on it.

**[VISUAL: A small ring of test particles, all with the same guiding centre, same v∥, same v⊥, but spread uniformly across all gyrophases θ. As time runs, this ring rotates rigidly around the guiding centre.]**

Formally: define the gyroaverage of any quantity as its average over $\theta$ holding the guiding centre position, $v_\parallel$, and the perpendicular speed fixed,

$$
\langle A \rangle_\theta = \frac{1}{2\pi}\int_0^{2\pi} A \, d\theta
$$

This is valid, crucially, only because the gyromotion is *fast* compared to everything else in the problem. Any electric or magnetic field structure that varies on scales slower than $\Omega_c^{-1}$ looks essentially frozen to a gyrating particle, so averaging over one full gyro-orbit doesn't wash out real physics, it only removes the part of the motion that was fast bookkeeping to begin with.

**[VISUAL: Introduce the magnetic moment as a small looping current, with a label "μ, the magnetic moment," shown to stay constant as the particle drifts through slowly varying B, even as v⊥ itself changes.]**

This averaging is closely tied to an old idea from single-particle theory: as long as the field changes slowly compared to the gyration, the **magnetic moment**

$$
\mu = \frac{m v_\perp^2}{2B}
$$

is an **adiabatic invariant**, meaning it stays very nearly constant along the particle's trajectory, even as $B$ itself changes. This is exactly analogous to the way a pendulum's action stays constant if you slowly change its length, an old and general result from classical mechanics dressed up in plasma clothing.

**[VISUAL: A phase-space diagram: axes labelled x, y, z, v∥, v⊥, θ (6D), with θ crossed out and an arrow pointing to a reduced diagram with axes X, Y, Z, v∥, μ (5D).]**

Once $\mu$ is treated as a constant of the motion and $\theta$ is averaged away entirely, our description of each particle collapses from six independent phase-space coordinates to five: the three components of guiding centre position, the parallel velocity, and the magnetic moment. That is the dimensional reduction we were promised in the introduction. We have gone from a 6D kinetic problem to a 5D one, for free, just by noticing that one of the six coordinates was fast, cyclic, and physically uninteresting.

---

## Section 5 — Making the ordering precise — 16:00

**[VISUAL: Two length scales drawn to compare: the Larmor radius ρ as a small circle, and the system size L, or the scale of background gradients, as the whole visible frame. A ratio ρ/L is written beneath.]**

Averaging over the gyrophase is only justified as an approximation, so gyrokinetics is built on an explicit small parameter, usually written

$$
\epsilon = \frac{\rho}{L} \ll 1
$$

the ratio of the Larmor radius to the scale over which background quantities, density, temperature, magnetic field, vary. In a tokamak this ratio really is small, typically somewhere around $10^{-3}$, which is precisely why the approximation works so well in practice rather than being a convenient fiction.

**[VISUAL: A second ratio appears alongside: ω/Ω_c, turbulence frequency over cyclotron frequency, likewise drawn much smaller than 1.]**

A second, related ordering constrains the frequencies we're allowed to describe:

$$
\frac{\omega}{\Omega_c} \sim \epsilon \ll 1
$$

The physics we want, turbulent fluctuations and the transport they drive, evolves on frequencies far below the cyclotron frequency. Gyrokinetics is explicitly a theory of *slow* dynamics; it is not meant to, and cannot, describe anything oscillating anywhere near $\Omega_c$ itself. That's a feature, not an omission: it is precisely the fast dynamics we engineered our way out of resolving.

**[VISUAL: A third relation: fluctuation amplitude δn/n, or eφ/T, likewise ordered as small, ~ε.]**

A third piece of the ordering constrains the size of the turbulent fluctuations themselves, their relative amplitude is also taken to be of order $\epsilon$. This matters because it lets us linearise the fields' effect on individual particle orbits, while still retaining the fully nonlinear interaction between the fluctuations and the slowly evolving background, which is exactly the interplay responsible for turbulent transport.

**[VISUAL: A short list, almost like a checklist, of what has been assumed: (1) ρ/L small, (2) ω/Ω_c small, (3) fluctuation amplitude small, (4) fluctuations vary slowly along B compared to across it.]**

There is one more piece of the ordering worth naming: fluctuations are assumed to vary much more rapidly *across* the field lines than *along* them, matching what turbulence actually looks like in a magnetised plasma, elongated, thread-like structures stretched along $\mathbf{B}$. Put all of these together and you get a single, self-consistent asymptotic expansion in $\epsilon$, and gyrokinetics is what falls out when you carry that expansion through the Vlasov–Maxwell system correctly, to the orders that matter.

---

## Section 6 — The gyrokinetic equation — 19:00

**[VISUAL: The original Vlasov equation from Section 1 fades in on the left. On the right, a new, related equation begins to build up piece by piece, in the same visual grammar so the correspondence is obvious.]**

Carrying the gyrokinetic ordering through the derivation properly, the result is an evolution equation for the gyroaveraged distribution function $\bar{f}(\mathbf{R}, v_\parallel, \mu, t)$, written in terms of the guiding centre position $\mathbf{R}$ rather than the particle position $\mathbf{x}$:

$$
\frac{\partial \bar f}{\partial t} + (\dot{\mathbf{R}})\cdot\nabla \bar f + \dot v_\parallel \frac{\partial \bar f}{\partial v_\parallel} = 0
$$

**[VISUAL: Highlight the guiding centre velocity term, and expand it into its constituent drifts, reusing the exact drift diagrams from Section 3.]**

where $\dot{\mathbf{R}}$ is exactly the sum of the drifts we derived by hand earlier: parallel streaming along $\mathbf{B}$, the grad-B drift, the curvature drift, and the $E\times B$ drift, now sourced by the *gyroaveraged* fluctuating fields rather than the raw fields at a point. That gyroaveraging of the fields is essential, and it's worth pausing on: a particle at guiding centre $\mathbf{R}$ doesn't feel the field exactly at $\mathbf{R}$, it feels the field averaged over the ring of positions its fast gyration actually visits. That averaging ring has a finite size, the Larmor radius, which is why gyrokinetics naturally retains **finite Larmor radius effects**, it doesn't just collapse the particle to a point.

**[VISUAL: The gyrokinetic Poisson equation appears beneath, visually "closing the loop" back to the drift terms above by drawing an arrow from φ into the E×B drift term.]**

This equation for $\bar f$ has to be closed by field equations for the fluctuating potentials, most simply a **gyrokinetic Poisson equation** relating the gyroaveraged charge density built from $\bar f$ back to the electrostatic potential $\phi$ that drives the $E\times B$ drift in the first place. (A fully electromagnetic version adds an equation for the fluctuating vector potential too, needed once magnetic fluctuations matter.) The system is self-consistent in exactly the same sense the original Vlasov–Maxwell system was, particles create the fields that move the particles, but now every term lives in five dimensions instead of six, and the timestep is no longer throttled by the cyclotron frequency.

**[VISUAL: Side-by-side cost comparison, drawn as two grid volumes: a 6D grid at cyclotron-frequency resolution versus a 5D grid at turbulence-frequency resolution, the second dramatically smaller and rendered at a visibly coarser, cheaper density.]**

That's the entire payoff, stated plainly: same underlying physics, one fewer dimension, and a governing frequency scale that's a billion times more forgiving. That's the difference between a simulation that's impossible and one you can run on a national supercomputing cluster overnight.

---

## Section 7 — Why this actually matters — 23:00

**[VISUAL: Logos or stylised name-cards for GENE, GYRO, GS2, GKW, CGYRO drifting past, then settling. Cut to a simulated turbulence movie, colourful eddies rippling across a tokamak cross-section, clearly a numerical output rather than the artistic rendering from the cold open.]**

Gyrokinetics is not just an elegant reduction on paper, it's the working engine behind essentially every serious prediction of turbulent transport in a modern tokamak. Codes like GENE, GYRO, GS2, and CGYRO all solve some version of the gyrokinetic equation, either by evolving $\bar f$ directly on a grid (continuum codes) or by following an ensemble of simulated marker particles along their guiding centre trajectories (particle-in-cell codes).

**[VISUAL: A plot of predicted heat flux against experimental measurements from a real device, points clustering near the diagonal line of agreement.]**

The output of these simulations, the turbulent heat and particle fluxes, feeds directly into reactor design. When engineers estimate how well ITER will confine its plasma, or optimise a stellarator's magnetic geometry to suppress turbulence, gyrokinetic simulation is the tool doing the heavy lifting underneath that estimate. Without the dimensional reduction in this video, those calculations would simply be out of computational reach, not slow, but genuinely, combinatorially infeasible.

**[VISUAL: Pull back to the full tokamak cutaway from the very start of the video, now with a translucent overlay of the eddy structures from the cold open.]**

It's worth sitting with how strange this is, as a piece of applied physics. Nobody sat down and guessed a simplified model of plasma turbulence. Gyrokinetics is derived, order by order, as a rigorous asymptotic limit of the exact kinetic equations, and it happens to also be the limit that is both tractable to simulate and accurate enough to design a reactor around. That's not a coincidence exactly, it's a reflection of the fact that nature really does separate its timescales as cleanly as the ordering assumes. When theory and computational necessity point at the same approximation, it's usually because the approximation is capturing something true.

---

## Closing — 26:00

**[VISUAL: Return to the cold open's turbulence footage one last time, now with guiding centre trajectories sketched over a handful of particles, tying the whole video back to its opening image.]**

So the next time you see a fusion headline about a new confinement record, remember that the prediction behind it likely rests on a piece of mathematics that starts with a very simple observation: a charged particle spinning around a field line is, most of the time, spinning around a piece of information you don't actually need. Average it away carefully, keep track of what that averaging leaves behind, and an impossible problem becomes a merely very hard one.

**[VISUAL: End card. Optional teaser line for a follow-up video on the derivation of the gyrokinetic Poisson equation, or on delta-f particle-in-cell methods.]**

If you want to go one level deeper, the natural next video is the delta-f method, how you can simulate turbulent fluctuations on top of a nearly static background even more efficiently, by only ever tracking the *deviation* from a known equilibrium. That's next.

---

### Production notes

- **Pacing**: Behiel's videos give equations time to breathe; don't cut away from a derived expression until the narration has explicitly used it. Budget roughly 1–1.5 minutes of screen time per major equation.
- **Colour convention**: pick one colour for "parallel to B" quantities and another for "perpendicular" quantities from Section 2 onward, and hold that convention for the whole video, including inside the final gyrokinetic equation, so the reduction is visually traceable back to its origin.
- **Recurring visual motif**: the helix-to-guiding-centre reduction from Section 3 should be redrawn, smaller, in a corner inset, any time the guiding centre coordinate $\mathbf{R}$ reappears later in the script, as a running reminder of what it stands for.
- **Manim scene list** (for use with the installed `manimce-best-practices` skill): (1) helical trajectory decomposition, (2) grad-B drift orbit distortion, (3) curvature drift schematic, (4) E×B drift schematic, (5) gyrophase ring animation for gyroaveraging, (6) 6D→5D phase space collapse diagram, (7) equation build-up for the gyrokinetic equation, (8) turbulence simulation still/loop (can be sourced from an actual GENE/GYRO output rather than animated from scratch).
