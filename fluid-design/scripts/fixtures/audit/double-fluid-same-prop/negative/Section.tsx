export function Section() {
  return <div className="lg:fluid-py-120 lg:fluid-px-80">content</div>
}

// gap-x and gap-y are different families -- must not be flagged as a
// duplicate, even though both start with "gap". The real ModelCard.tsx case.
export function Stats() {
  return <div className="lg:fluid-gap-x-24 lg:fluid-gap-y-8 flex flex-wrap">content</div>
}

// p / px / pt are different families too.
export function Padded() {
  return <div className="lg:fluid-p-40 lg:fluid-px-24 lg:fluid-pt-8">content</div>
}

// w vs min-w must not collide either.
export function Sized() {
  return <div className="lg:fluid-w-512 lg:fluid-min-w-320">content</div>
}
