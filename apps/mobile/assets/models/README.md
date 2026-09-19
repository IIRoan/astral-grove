# Models

## d20.glb and d20-diffuse.png

The d20 mesh and its number texture come from the "default" theme of [3d-dice/dice-themes](https://github.com/3d-dice/dice-themes) by Frank Ali. The Babylon JSON mesh was converted to glTF (z negated to make it right-handed, no textures embedded), and the diffuse map is the theme's `diffuse-dark.png` composited over ivory resin at 512px. `lib/d20.ts` bakes the theme's collider hull and `colliderFaceMap`, so physics and value reading match the mesh exactly.

MIT License

Copyright (c) 2022 3D Dice

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
