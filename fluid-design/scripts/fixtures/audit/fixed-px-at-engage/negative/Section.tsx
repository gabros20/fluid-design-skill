export function Section() {
  return (
    <div className="lg:fluid-py-120 lg:fluid-w-512">
      content
    </div>
  )
}

// A comment mentioning the bug pattern verbatim must not trigger:
// <div className="lg:py-[120px] lg:w-[512px]" />
