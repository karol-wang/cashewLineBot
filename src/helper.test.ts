import { describe, expect, it } from 'vitest';
import { createFlexMessage } from './helper';

interface TextComponent {
  type: 'text';
  text: string;
  color?: string;
}

const collectTextComponents = (value: unknown): TextComponent[] => {
  if (Array.isArray(value)) {
    return value.flatMap(collectTextComponents);
  }

  if (!value || typeof value !== 'object') {
    return [];
  }

  const component = value as Record<string, unknown>;
  const current =
    component.type === 'text' && typeof component.text === 'string'
      ? [component as unknown as TextComponent]
      : [];

  return [...current, ...Object.values(component).flatMap(collectTextComponents)];
};

describe('createFlexMessage', () => {
  it('支出金額顯示紅色，收入金額顯示綠色', () => {
    const flexMessage = createFlexMessage(
      [
        { category: '飲食', subcategory: '早餐', amount: -100, date: '2026-08-07' },
        { category: '錢錢來啦', subcategory: '信用卡回饋', amount: 500, date: '2026-08-07' },
      ],
      { app: 'https://app.example.com', webApp: 'https://web.example.com' }
    );
    const textComponents = collectTextComponents(flexMessage);

    expect(textComponents.find(component => component.text === '$100')?.color).toBe('#C62828');
    expect(textComponents.find(component => component.text === '$500')?.color).toBe('#2E7D32');
  });

  it('分類名稱維持灰色，不跟著金額變色', () => {
    const flexMessage = createFlexMessage(
      [{ category: '飲食', subcategory: '早餐', amount: -100, date: '2026-08-07' }],
      { app: 'https://app.example.com', webApp: 'https://web.example.com' }
    );
    const textComponents = collectTextComponents(flexMessage);

    expect(textComponents.find(component => component.text === '飲食 - 早餐')?.color).toBe(
      '#666666'
    );
  });
});
