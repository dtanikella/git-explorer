import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PinZonePicker from '@/app/components/areas/PinZonePicker';
import '@testing-library/jest-dom';

describe('PinZonePicker', () => {
  it('toggles a cell on and off', () => {
    const onChange = jest.fn();
    const { rerender } = render(
      <PinZonePicker areaId="test" value={[]} onChange={onChange} />
    );

    const cell0 = screen.getByTestId('pin-zone-cell-test-0');
    expect(cell0).toHaveAttribute('aria-pressed', 'false');

    // Toggle on
    fireEvent.click(cell0);
    expect(onChange).toHaveBeenCalledWith([0]);

    // Simulate parent updating value
    rerender(
      <PinZonePicker areaId="test" value={[0]} onChange={onChange} />
    );
  });

  it('reflects an externally-set value prop', () => {
    const onChange = jest.fn();
    const { rerender } = render(
      <PinZonePicker areaId="test" value={[0, 4, 8]} onChange={onChange} />
    );

    expect(screen.getByTestId('pin-zone-cell-test-0')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('pin-zone-cell-test-4')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('pin-zone-cell-test-8')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('pin-zone-cell-test-1')).toHaveAttribute('aria-pressed', 'false');

    // Rerender with empty value
    rerender(
      <PinZonePicker areaId="test" value={[]} onChange={onChange} />
    );
    expect(screen.getByTestId('pin-zone-cell-test-0')).toHaveAttribute('aria-pressed', 'false');
  });

  it('applies hover styles only to unselected cells', () => {
    const onChange = jest.fn();
    render(
      <PinZonePicker areaId="test" value={[4]} onChange={onChange} />
    );

    const selectedCell = screen.getByTestId('pin-zone-cell-test-4');
    const unselectedCell = screen.getByTestId('pin-zone-cell-test-0');

    // Check initial backgrounds
    expect(selectedCell).toHaveStyle('background: #3b82f6');
    expect(unselectedCell).toHaveStyle('background: #ffffff');

    // Hover over the selected cell — style should NOT change (still selected blue)
    fireEvent.mouseEnter(selectedCell);
    expect(selectedCell).toHaveStyle('background: #3b82f6');

    // Hover over an unselected cell — style should change to blue-wash
    fireEvent.mouseEnter(unselectedCell);
    expect(unselectedCell).toHaveStyle('background: #eff6ff');

    // Mouse leave — should revert
    fireEvent.mouseLeave(unselectedCell);
    expect(unselectedCell).toHaveStyle('background: #ffffff');
  });
});