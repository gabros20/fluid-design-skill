// No @custom-variant dark anywhere in this directory -- if `dark:` matched
// as a bare substring, this file alone would trip the rule. It must not:
// every occurrence here is an object key or a value, never a class variant.
export const iconTheme = {
  dark: {
    logo: 'brightness-0 invert'
  },
  light: {
    logo: 'brightness-100'
  }
}

export const markClass = 'dark: this has a space after the colon, not a variant'
