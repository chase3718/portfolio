import { useEffect, useState } from 'react';
import './Toast.css';

interface ToastProps {
	message: string;
	onClose: () => void;
	duration?: number;
}

export default function Toast({ message, onClose, duration = 5000 }: ToastProps) {
	const [isVisible, setIsVisible] = useState(true);

	useEffect(() => {
		const timer = setTimeout(() => {
			setIsVisible(false);
			setTimeout(onClose, 300); // Wait for fade out animation
		}, duration);

		return () => clearTimeout(timer);
	}, [duration, onClose]);

	const handleClose = () => {
		setIsVisible(false);
		setTimeout(onClose, 300);
	};

	return (
		<div className={`toast ${isVisible ? 'visible' : ''}`}>
			<span className="toast-message">{message}</span>
			<button className="toast-close" onClick={handleClose}>
				×
			</button>
		</div>
	);
}
