import { describe, expect, it } from "vitest";
import {
  IOR,
  abbeSpread,
  dispersedIor,
  fresnelSchlick,
  iorToEta,
  refract,
  refractOffsetPx,
  schlickF0,
  type Vec3,
} from "../src/optics";

const N: Vec3 = [0, 0, 1];

describe("refract", () => {
  it("normale paralel gelen ışın hiç kırılmaz", () => {
    const r = refract([0, 0, -1], N, iorToEta(IOR.air, IOR.crownGlass));
    expect(r[0]).toBeCloseTo(0, 12);
    expect(r[1]).toBeCloseTo(0, 12);
    expect(r[2]).toBeCloseTo(-1, 12);
  });

  it("Snell yasasını sağlar: sin(t) = eta * sin(i)", () => {
    const a = Math.PI / 6; // 30 derece
    const i: Vec3 = [Math.sin(a), 0, -Math.cos(a)];
    const eta = iorToEta(IOR.air, IOR.crownGlass);
    const r = refract(i, N, eta);
    const sinT = Math.hypot(r[0], r[1]);
    expect(sinT).toBeCloseTo(eta * Math.sin(a), 10);
  });

  it("kritik açının ötesinde sıfır vektör döndürür", () => {
    const a = Math.PI / 4;
    const i: Vec3 = [Math.sin(a), 0, -Math.cos(a)];
    const r = refract(i, N, iorToEta(IOR.crownGlass, IOR.air)); // cam -> hava
    expect(r).toEqual([0, 0, 0]);
  });
});

describe("refractOffsetPx", () => {
  const tilted: Vec3 = [0.6, 0, 0.8]; // pahtan gelen tipik bir normal

  it("düz yüzeyde kayma sıfırdır", () => {
    const off = refractOffsetPx([0, 0, 1], iorToEta(1, IOR.crownGlass), 90);
    expect(Math.hypot(off[0], off[1])).toBeCloseTo(0, 10);
  });

  it("IOR büyüdükçe kayma büyür", () => {
    const water = refractOffsetPx(tilted, iorToEta(1, IOR.water), 90);
    const glass = refractOffsetPx(tilted, iorToEta(1, IOR.crownGlass), 90);
    const diamond = refractOffsetPx(tilted, iorToEta(1, IOR.diamond), 90);
    const mag = (v: readonly [number, number]) => Math.hypot(v[0], v[1]);
    expect(mag(water)).toBeLessThan(mag(glass));
    expect(mag(glass)).toBeLessThan(mag(diamond));
  });

  it("kayma cam kalınlığıyla doğrusal büyür", () => {
    const a = refractOffsetPx(tilted, iorToEta(1, IOR.crownGlass), 45);
    const b = refractOffsetPx(tilted, iorToEta(1, IOR.crownGlass), 90);
    expect(b[0]).toBeCloseTo(a[0] * 2, 10);
  });

  it("mavi kanal kırmızıdan daha çok bükülür", () => {
    const red = refractOffsetPx(tilted, iorToEta(1, 1.5168 - 0.0081 / 2), 90);
    const blue = refractOffsetPx(tilted, iorToEta(1, 1.5168 + 0.0081 / 2), 90);
    expect(Math.hypot(blue[0], blue[1])).toBeGreaterThan(
      Math.hypot(red[0], red[1]),
    );
  });
});

describe("malzeme sabitleri", () => {
  it("hava-cam arayüzünde dik yansıma yaklaşık %4", () => {
    expect(schlickF0(IOR.air, IOR.crownGlass)).toBeCloseTo(0.0426, 4);
  });

  it("BK7'nin Abbe yayılımı binde sekiz civarı", () => {
    expect(abbeSpread(1.5168, 64.17)).toBeCloseTo(0.00805, 5);
  });

  it("Fresnel sıyırma açısında bire koşar", () => {
    expect(fresnelSchlick(1, 0.04)).toBeCloseTo(0.04, 6);
    expect(fresnelSchlick(0, 0.04)).toBeCloseTo(1, 6);
  });
});

describe("kenar durumları", () => {
  it("refract girdi vektörlerini bozmaz", () => {
    const i: Vec3 = [0.3, 0.2, -0.9327379053088815];
    const n: Vec3 = [0, 0, 1];
    refract(i, n, 0.658);
    expect(i).toEqual([0.3, 0.2, -0.9327379053088815]);
    expect(n).toEqual([0, 0, 1]);
  });

  it("tam iç yansımada kayma sıfırdır", () => {
    // Cam -> hava yönünde sıyırma açısına yakın bir normal: refract() ölür.
    const grazing: Vec3 = [0.99, 0, Math.sqrt(1 - 0.99 * 0.99)];
    const off = refractOffsetPx(grazing, iorToEta(IOR.crownGlass, IOR.air), 90);
    expect(off).toEqual([0, 0]);
  });

  it("iorToEta havadan cama 1/n verir", () => {
    expect(iorToEta(1, 1.5)).toBeCloseTo(2 / 3, 12);
    expect(iorToEta(1.5, 1)).toBeCloseTo(1.5, 12);
  });

  it("dispersedIor mavi ucu kırmızı ucun üstüne koyar", () => {
    const red = dispersedIor(1.5168, 0.008, 0);
    const blue = dispersedIor(1.5168, 0.008, 1);
    expect(red).toBeLessThan(blue);
    expect(blue - red).toBeCloseTo(0.008, 12);
    expect(dispersedIor(1.5168, 0.008, 0.5)).toBeCloseTo(1.5168, 12);
  });

  it("Fresnel [f0, 1] aralığında kalır", () => {
    for (let i = 0; i <= 20; i++) {
      const f = fresnelSchlick(i / 20, 0.0426);
      expect(f).toBeGreaterThanOrEqual(0.0426 - 1e-12);
      expect(f).toBeLessThanOrEqual(1 + 1e-12);
    }
  });
});
