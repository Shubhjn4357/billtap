import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AppStatusBadge } from '../src/components/ui/AppStatusBadge';

describe('AppStatusBadge Component', () => {
    it('renders with success status', () => {
        render(<AppStatusBadge status="ACTIVE" label="Active Plan" />);
        const badge = screen.getByText('Active Plan');
        expect(badge).toBeInTheDocument();
        // Assuming a success class or style is applied based on "ACTIVE"
    });

    it('renders with danger/error status', () => {
        render(<AppStatusBadge status="CANCELLED" label="Cancelled Plan" />);
        const badge = screen.getByText('Cancelled Plan');
        expect(badge).toBeInTheDocument();
    });

    it('renders default fallback state when status is unknown', () => {
        render(<AppStatusBadge status="SOMETHING_ELSE" label="Unknown" />);
        expect(screen.getByText('Unknown')).toBeInTheDocument();
    });
});
