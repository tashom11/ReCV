import './heroIllustration.css'

/**
 * Animated illustration of the welcome screen: a CV, a job posting arriving, the matching lines lighting up and moving
 * up, then the validation badge. Decorative, made of classes only (no inline style), 2 cycles then it stops on its
 * final state; with « reduce motion », the final state is shown at once. The same drawing is on the website
 * (site/index.html): keep both identical.
 */
export function HeroIllustration() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" className="rv" aria-hidden="true" focusable="false">
      <g className="rv-st" transform="translate(-20 1)">
        <g className="rv-bk">
          <rect className="rv-sf rv-trs" x="64" y="74" width="200" height="280" rx="20" />
          <rect className="rv-tf" opacity=".45" x="84" y="98" width="110" height="11" rx="5.5" />
          <g className="rv-tr">
            <rect x="84" y="118" width="74" height="9" rx="4.5" />
            <rect x="84" y="150" width="96" height="8" rx="4" />
            <rect x="84" y="168" width="80" height="8" rx="4" />
            <rect x="84" y="186" width="96" height="8" rx="4" />
            <rect x="84" y="204" width="80" height="8" rx="4" />
          </g>
        </g>
        <g className="rv-fr">
          <rect className="rv-ik" opacity=".07" x="100" y="70" width="210" height="294" rx="20" />
          <rect className="rv-sf rv-iks" x="100" y="60" width="210" height="294" rx="20" />
          <circle className="rv-mp rv-mqs" cx="136" cy="100" r="17" />
          <rect className="rv-ik" x="164" y="89" width="94" height="11" rx="5.5" />
          <rect className="rv-mq" x="164" y="106" width="66" height="8" rx="4" />
          <g className="rv-ac">
            <rect x="118" y="130" width="50" height="16" rx="8" />
            <rect x="174" y="130" width="40" height="16" rx="8" />
            <rect x="220" y="130" width="62" height="16" rx="8" />
          </g>
          <g className="rv-tr">
            <g className="rv-mv rv-x rv-y1">
              <rect x="118" y="166" width="174" height="8" rx="4" />
            </g>
            <g className="rv-mv rv-x rv-y1">
              <rect x="118" y="186" width="156" height="8" rx="4" />
            </g>
            <g className="rv-mv rv-x rv-y2">
              <rect x="118" y="226" width="110" height="8" rx="4" />
            </g>
            <g className="rv-mv rv-x rv-y3">
              <rect x="118" y="266" width="148" height="8" rx="4" />
            </g>
            <g className="rv-mv rv-x">
              <rect x="118" y="306" width="124" height="8" rx="4" />
            </g>
            <g className="rv-mv rv-u1">
              <rect className="rv-hl rv-ap" x="110" y="201" width="190" height="18" rx="9" />
              <rect x="118" y="206" width="174" height="8" rx="4" />
              <rect className="rv-hl rv-ac" x="118" y="206" width="174" height="8" rx="4" />
            </g>
            <g className="rv-mv rv-u2 rv-d1">
              <rect className="rv-hl rv-ap rv-d1" x="110" y="241" width="190" height="18" rx="9" />
              <rect x="118" y="246" width="168" height="8" rx="4" />
              <rect className="rv-hl rv-ac rv-d1" x="118" y="246" width="168" height="8" rx="4" />
            </g>
            <g className="rv-mv rv-u3 rv-d2">
              <rect className="rv-hl rv-ap rv-d2" x="110" y="281" width="190" height="18" rx="9" />
              <rect x="118" y="286" width="174" height="8" rx="4" />
              <rect className="rv-hl rv-ac rv-d2" x="118" y="286" width="174" height="8" rx="4" />
            </g>
          </g>
          <path className="rv-cn" pathLength={1} d="M300 124C304 160 300 196 296 210" />
          <path className="rv-cn rv-d1" pathLength={1} d="M300 124C306 170 296 236 290 250" />
          <path className="rv-cn rv-d2" pathLength={1} d="M300 124C308 190 300 276 296 290" />
        </g>
        <g className="rv-jb">
          <rect className="rv-sf rv-iks" x="262" y="28" width="124" height="100" rx="16" />
          <rect className="rv-ap rv-iks" x="278" y="52" width="26" height="20" rx="5" />
          <path className="rv-iks" fill="none" d="M285 52v-4h12v4M278 61h26" />
          <rect className="rv-tf" x="316" y="50" width="54" height="8" rx="4" />
          <g className="rv-tr">
            <rect x="316" y="64" width="38" height="7" rx="3.5" />
            <rect x="278" y="86" width="92" height="7" rx="3.5" />
          </g>
          <g className="rv-ac">
            <rect x="278" y="104" width="34" height="12" rx="6" />
            <rect x="318" y="104" width="28" height="12" rx="6" />
            <rect x="352" y="104" width="18" height="12" rx="6" />
          </g>
        </g>
        <g className="rv-ok">
          <circle className="rv-mq" cx="306" cy="344" r="26" />
          <path className="rv-tk" pathLength={1} d="M295 344.5l7 7 14-14.5" />
          <circle className="rv-rg rv-mqs" fill="none" cx="306" cy="344" r="26" />
        </g>
      </g>
    </svg>
  )
}
