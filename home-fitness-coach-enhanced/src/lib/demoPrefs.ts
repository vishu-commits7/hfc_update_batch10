import type { FigureGender } from "../components/HumanFigure";
import type { DemoTone } from "./exercisePhotos.generated";

/**
 * How the exercise demos are shown: which figure, and which photographic
 * model.
 *
 * Both were read inline in three different components, each with its own
 * slightly different fallback chain, which is how the Academy could be
 * showing a female figure while a workout card two screens away showed a
 * male one. One reader, one order of precedence.
 *
 * Neither is asked for at sign-up. The demo gender defaults to whatever
 * the user told the profile, and the model defaults and is changed in the
 * Academy — a first-run question about which race of model you want to
 * look at is not a good first impression of a fitness app.
 */

const GENDER_KEY = "kinetic_demo_gender";
const MODEL_KEY = "kinetic_demo_model";

export function readDemoGender(_profileGender?: string): FigureGender {
  return "male";
}

export function writeDemoGender(_g: FigureGender) {
  try {
    window.localStorage.setItem(GENDER_KEY, "male");
  } catch {
    // Private mode or blocked storage
  }
}

export function readDemoModel(): DemoTone {
  try {
    return window.localStorage.getItem(MODEL_KEY) === "black" ? "black" : "white";
  } catch {
    return "white";
  }
}

export function writeDemoModel(m: DemoTone) {
  try {
    window.localStorage.setItem(MODEL_KEY, m);
  } catch {
    /* see above */
  }
}
