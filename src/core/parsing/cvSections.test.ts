import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { detectCvSections } from './cvSections'

const fixture = (name: string) => readFileSync(`fixtures/benchmark/${name}.txt`, 'utf8')

describe('detectCvSections', () => {
  it('finds the usual headings, whatever their case and accents', () => {
    expect(detectCvSections(fixture('01-classic'))).toEqual({
      experiences: true,
      education: true,
      skills: true,
      languages: true,
    })
  })

  it('finds less usual headings (« MON PARCOURS », « CE QUE JE SAIS FAIRE », « DIPLÔMES »)', () => {
    expect(detectCvSections(fixture('03-career-change'))).toMatchObject({
      experiences: true,
      education: true,
      skills: true,
    })
  })

  it('finds headings in a two-column text where they share the line with the other column', () => {
    // « COMPÉTENCES » is alone on its line; « LANGUES » too.
    expect(detectCvSections(fixture('02-two-columns'))).toMatchObject({ skills: true, languages: true })
  })

  it('recognises positions held from dated lines in a CV without headings', () => {
    expect(detectCvSections(fixture('05-minimal'))).toMatchObject({ experiences: true, education: false })
  })

  it('does not take a sentence of the profile for a heading', () => {
    const text = 'Développeuse passionnée avec 5 ans d’expérience en applications web, à l’écoute des utilisateurs.'
    expect(detectCvSections(text).experiences).toBe(false)
  })

  it('does not take the dates of a student CV for positions held', () => {
    const text = 'FORMATION\nMaster Informatique 2022 – 2024\nLicence Informatique 2019 – 2022'
    expect(detectCvSections(text)).toMatchObject({ experiences: false, education: true })
  })
})
