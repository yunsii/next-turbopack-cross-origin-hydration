import Document, { Html, Head, Main, NextScript } from 'next/document'
import { HtmlContext } from 'next/dist/shared/lib/html-context.shared-runtime'
import { useContext } from 'react'

// Simulates "point assets at a cross-origin CDN per host" — common in real apps
// (a custom _document / middleware / nginx rewrites assetPrefix by domain).
// At SSR time, force the <script src> and __NEXT_DATA__.assetPrefix to the
// cross-origin CDN (cdn.local), regardless of the build-time assetPrefix.
const CDN = 'http://cdn.local:3000/sub'

function CustomHtml(props: any) {
  const ctx = useContext(HtmlContext) as any
  if (ctx) ctx.assetPrefix = CDN
  return (
    <HtmlContext.Provider value={ctx}>
      <Html {...props} />
    </HtmlContext.Provider>
  )
}

const orig = (NextScript as any).getInlineScriptSource
;(NextScript as any).getInlineScriptSource = (props: any) => {
  if (props?.__NEXT_DATA__) props.__NEXT_DATA__.assetPrefix = CDN
  return orig(props)
}

export default class MyDoc extends Document {
  render() {
    return (
      <CustomHtml>
        <Head />
        <body>
          <Main />
          <NextScript />
        </body>
      </CustomHtml>
    )
  }
}
