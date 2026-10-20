// @vitest-environment happy-dom
import type { Profile } from '@core/schemas'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { expectNoA11yViolations } from '../../test/a11y'
import { PresentationSection } from './PresentationSection'
import { emptyProfile } from './profileDraft'

afterEach(cleanup)

function show(draft: Profile, onSuggest = () => undefined) {
  return render(
    <PresentationSection
      draft={draft}
      update={() => undefined}
      onSuggest={onSuggest}
      suggesting={false}
      suggestDisabled={false}
      showSuggestStep={false}
      feedback={null}
    />,
  )
}

// The section is closed by default (native <details>): its content is still in the page.
const suggestButton = () => screen.getByRole('button', { name: 'Proposer une phrase', hidden: true })

describe('PresentationSection', () => {
  it('disables the suggestion, and says why, while no quality is listed', () => {
    show({ ...emptyProfile(), skills: ['SQL', 'Git', ''] })
    expect((suggestButton() as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(/ajoutez d’abord au moins une qualité/, { exact: false })).toBeTruthy()
  })

  it('disables it for an empty form', () => {
    show(emptyProfile())
    expect((suggestButton() as HTMLButtonElement).disabled).toBe(true)
  })

  it('enables it as soon as a quality (rigueur, autonomie…) is listed, and drops the explanation', () => {
    const onSuggest = vi.fn()
    show({ ...emptyProfile(), skills: ['SQL', 'Rigueur'] }, onSuggest)
    expect((suggestButton() as HTMLButtonElement).disabled).toBe(false)
    expect(screen.queryByText(/ajoutez d’abord au moins une qualité/, { exact: false })).toBeNull()
    fireEvent.click(suggestButton())
    expect(onSuggest).toHaveBeenCalledTimes(1)
  })

  it('has no accessibility violation', async () => {
    const { container } = show(emptyProfile())
    await expectNoA11yViolations(container)
  })
})
