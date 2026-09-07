/**
 * Take focus off a submitted form's field, on touch devices only, so the
 * on-screen keyboard closes with the submit that asked for it.
 *
 * ## Why it is needed at all
 *
 * Submitting a form does not blur anything. The field keeps focus, so on a
 * phone the keyboard stays up over the results the reader just asked for — on a
 * shell that is `h-dvh overflow-hidden` and has no scroll to spare, which is
 * half of why the page looks displaced afterwards. The landing's bar has a
 * second reason: it measures its own rect at submit time and hands it to
 * Explore for the arrival animation, and a rect measured while the browser has
 * the page shifted up for a keyboard is a rect Explore then animates *from*.
 *
 * ## Why only on a coarse pointer
 *
 * There is no keyboard to dismiss on a desktop, and blurring there would take
 * focus off the field a keyboard user is still typing in every time they press
 * Enter. The media query is the difference between fixing a phone and breaking
 * a desktop, so it is not an optimisation.
 *
 * @param form the form that was submitted. Only a field inside it is blurred —
 *   never whatever else on the page happens to hold focus.
 */
export function dismissKeyboard(form: HTMLFormElement): void {
  if (!window.matchMedia("(pointer: coarse)").matches) return;

  const active = document.activeElement;
  if (active instanceof HTMLElement && form.contains(active)) active.blur();
}
