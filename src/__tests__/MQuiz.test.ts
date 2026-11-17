import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import MQuiz from '../components/MQuiz.vue'
import type { QuizQuestion, QuizResult } from '../components/MQuiz.vue'

afterEach(() => vi.useRealTimers())

const questions: QuizQuestion[] = [
  { id: 'q1', prompt: 'Capital of France?', options: ['Lyon', 'Paris', 'Nice'], answer: 1, explanation: 'Paris since 508.' },
  { id: 'q2', type: 'multiple', prompt: 'Prime numbers?', options: ['2', '4', '5'], answer: [0, 2], points: 2 },
  { id: 'q3', type: 'truefalse', prompt: 'Water boils at 100 °C at sea level.', answer: true },
  { id: 'q4', type: 'text', prompt: 'Largest ocean?', answer: ['Pacific', 'Pacific Ocean'] },
  { id: 'q5', type: 'order', prompt: 'Smallest to largest', options: ['one', 'two', 'three'] },
]

type W = ReturnType<typeof mount>
const click = (w: W, sel: string) => w.find(sel).trigger('click')

async function solveOrder(w: W) {
  // bubble-sort with the up buttons until solved
  for (let pass = 0; pass < 3; pass++) {
    const items = w.findAll('[data-order-item]').map((e) => Number(e.attributes('data-order-item')))
    for (let p = 1; p < items.length; p++) {
      const now = w.findAll('[data-order-item]').map((e) => Number(e.attributes('data-order-item')))
      if (now[p]! < now[p - 1]!) await w.findAll('[data-order-item]')[p]!.find('[data-move="up"] , button').trigger('click')
    }
  }
}

describe('MQuiz', () => {
  it('checks each answer right away with its explanation', async () => {
    const w = mount(MQuiz, { props: { questions } })
    expect(w.find('[data-progress-text]').text()).toBe('Question 1 of 5')
    expect(w.find('[data-action="check"]').attributes('disabled')).toBeDefined()
    await click(w, '[data-option="0"]')
    await click(w, '[data-action="check"]')
    expect(w.find('[data-feedback]').text()).toContain('Not quite')
    expect(w.find('[data-feedback]').text()).toContain('Paris since 508.')
    expect(w.find('[data-option="1"]').attributes('data-state')).toBe('correct')
    expect(w.find('[data-option="0"]').attributes('data-state')).toBe('wrong')
    expect(w.emitted('answer')![0]![0]).toEqual({ id: 'q1', value: 0, correct: false })
  })

  it('scores a full run with every question type', async () => {
    const w = mount(MQuiz, { props: { questions, passScore: 70 } })
    // q1 right
    await click(w, '[data-option="1"]'); await click(w, '[data-action="check"]'); await click(w, '[data-action="next"]')
    // q2 right (2 points)
    await click(w, '[data-option="0"]'); await click(w, '[data-option="2"]'); await click(w, '[data-action="check"]')
    expect(w.find('[data-feedback]').text()).toContain('Correct!')
    await click(w, '[data-action="next"]')
    // q3 wrong
    await click(w, '[data-option="false"]'); await click(w, '[data-action="check"]'); await click(w, '[data-action="next"]')
    // q4 right, ignoring case and accents
    await w.find('[data-text-answer]').setValue('  pacífic ocean ')
    await click(w, '[data-action="check"]')
    expect(w.find('[data-feedback]').text()).toContain('Correct!')
    await click(w, '[data-action="next"]')
    // q5: put in order
    await solveOrder(w)
    expect(w.findAll('[data-order-item]').map((e) => e.attributes('data-order-item'))).toEqual(['0', '1', '2'])
    await click(w, '[data-action="check"]')
    await click(w, '[data-action="next"]')

    const r = w.emitted('finish')![0]![0] as QuizResult
    expect(r.score).toBe(5)
    expect(r.total).toBe(6)
    expect(r.percent).toBe(83)
    expect(r.passed).toBe(true)
    expect(w.find('[data-passed]').text()).toBe('Passed')
    expect(w.find('[data-score]').text()).toBe('5 of 6 points')
    expect(w.find('[data-review="q3"]').text()).toContain('Correct answer: True')
  })

  it('reveals answers only at the end with feedback="end"', async () => {
    const w = mount(MQuiz, { props: { questions: questions.slice(0, 1), feedback: 'end' } })
    await click(w, '[data-option="0"]')
    expect(w.find('[data-action="check"]').exists()).toBe(false)
    await click(w, '[data-action="next"]')
    expect(w.find('[data-feedback]').exists()).toBe(false)
    expect((w.emitted('finish')![0]![0] as QuizResult).score).toBe(0)
  })

  it('never starts an order question solved and retries from scratch', async () => {
    const w = mount(MQuiz, { props: { questions: [questions[4]!] } })
    const order = w.findAll('[data-order-item]').map((e) => e.attributes('data-order-item'))
    expect(order).not.toEqual(['0', '1', '2'])
    await click(w, '[data-action="check"]')
    await click(w, '[data-action="next"]')
    await click(w, '[data-action="retry"]')
    expect(w.find('[data-prompt]').exists()).toBe(true)
  })

  it('ends when the time runs out', async () => {
    vi.useFakeTimers()
    const w = mount(MQuiz, { props: { questions, timeLimit: 3 } })
    expect(w.find('[data-timer]').text()).toContain('0:03')
    vi.advanceTimersByTime(3000)
    await w.vm.$nextTick()
    expect(w.emitted('finish')).toHaveLength(1)
    expect(w.find('[data-result]').exists()).toBe(true)
    w.unmount()
  })
})
