export function Section() {
  return (
    <div className="lg:py-[120px] lg:w-[512px] lg:border-[1px] lg:rounded-[4px] lg:tracking-[0.02em] lg:max-w-[753px]">
      content
    </div>
  )
}

// A hairline seam (<= 2px) is a judgement call, not the bug: it still trips
// the rule (a finding must be reported) but at info severity, not error.
export function Hairline() {
  return <div className="lg:gap-[2px]">content</div>
}
