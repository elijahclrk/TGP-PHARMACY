export default function Brand({ light = false }) {
  return <div className={`brand ${light ? 'brand-light' : ''}`} aria-label="TGP Pharmacy — The Generics"><span className="brand-mark" aria-hidden="true">tgp</span><span className="brand-name"><strong>The Generics</strong><small>PHARMACY</small></span></div>
}
