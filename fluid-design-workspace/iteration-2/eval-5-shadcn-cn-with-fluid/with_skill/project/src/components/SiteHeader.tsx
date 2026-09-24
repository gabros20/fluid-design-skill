export function SiteHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 pt-[var(--header-h)]">
      <nav className="mx-auto flex items-center justify-between fluid-container lg:fluid-ui-h-48">
        <a href="/" className="font-semibold lg:fluid-ui-text-20">Acme</a>
        <ul className="flex lg:fluid-ui-gap-32 lg:fluid-ui-text-14">
          <li><a href="#product">Product</a></li>
          <li><a href="#pricing">Pricing</a></li>
        </ul>
      </nav>
    </header>
  )
}
