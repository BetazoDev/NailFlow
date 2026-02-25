'use client';

import ImageUploadStep from './ImageUploadStep';
import PersonalDataStep from './PersonalDataStep';
import { useState } from 'react';

interface DetailsStepProps {
    imagePreview: string | null;
    notes: string;
    onImageChange: (url: string | null) => void;
    onNotesChange: (notes: string) => void;
    name: string;
    phone: string;
    email: string;
    onNameChange: (n: string) => void;
    onPhoneChange: (p: string) => void;
    onEmailChange: (e: string) => void;
    onNext: () => void;
    onBack: () => void;
}

export default function DetailsStep(props: DetailsStepProps) {
    const [mobileView, setMobileView] = useState<'image' | 'personal'>('image');

    // On mobile, these act as two sequential screens inside this single step
    const handleMobileNext = () => setMobileView('personal');
    const handleMobileBack = () => setMobileView('image');

    return (
        <div className="flex flex-col lg:flex-row h-full">
            {/* Image (Left on Desktop, Screen 1 on Mobile) */}
            <div className={`flex-1 lg:border-r lg:border-cream-dark/50 flex flex-col h-full lg:overflow-y-auto custom-scrollbar ${mobileView === 'personal' ? 'hidden lg:flex' : 'flex'}`}>
                <ImageUploadStep
                    imagePreview={props.imagePreview}
                    notes={props.notes}
                    onImageChange={props.onImageChange}
                    onNotesChange={props.onNotesChange}
                    onNext={() => {
                        // If desktop, do nothing. If mobile, go to personal
                        if (window.innerWidth < 1024) handleMobileNext();
                    }}
                    onBack={props.onBack}
                />
            </div>

            {/* Personal Data (Right on Desktop, Screen 2 on Mobile) */}
            <div className={`flex-[1.2] flex flex-col h-full lg:overflow-y-auto custom-scrollbar bg-cream/30 lg:bg-transparent ${mobileView === 'image' ? 'hidden lg:flex' : 'flex'}`}>
                <PersonalDataStep
                    name={props.name}
                    phone={props.phone}
                    email={props.email}
                    onNameChange={props.onNameChange}
                    onPhoneChange={props.onPhoneChange}
                    onEmailChange={props.onEmailChange}
                    onNext={props.onNext}
                    onBack={() => {
                        if (window.innerWidth < 1024) handleMobileBack();
                        else props.onBack();
                    }}
                />
            </div>
        </div>
    );
}
