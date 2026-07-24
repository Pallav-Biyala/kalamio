/**
 * Compact "Step X of 3" indicator shown on every publish phase (Editor → Details → Scroll cover),
 * so the writer always knows where they are in the flow. Dots always render (they carry the step on
 * mobile); the text label appears from `sm` up.
 *
 * @param {{ current: 1 | 2 | 3 }} props
 */
const PublishSteps = ({ current }) => (
  <div className="publish-steps" role="status" aria-label={`Step ${current} of 3`}>
    <div className="publish-steps__dots">
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          className={`publish-steps__dot${n < current ? ' is-done' : ''}${n === current ? ' is-active' : ''}`}
        />
      ))}
    </div>
    <span className="publish-steps__label hidden sm:inline">Step {current} of 3</span>
  </div>
);

export default PublishSteps;
