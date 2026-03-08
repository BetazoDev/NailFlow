'use client';

import { Staff } from '@/lib/types';
import { api } from '@/lib/api';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

interface StaffStepProps {
    selectedStaffId: string | null;
    onSelect: (staff: Staff, isAny: boolean) => void;
    onNext: () => void;
    onBack: () => void;
}

export default function StaffStep({ selectedStaffId, onSelect, onNext, onBack }: StaffStepProps) {
    const params = useParams();
    const domain = params.domain as string;
    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.getStaff()
            .then(data => setStaffList(data || []))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [domain]);

    return (
        <div className="flex flex-col h-full animate-fade-in-up">
            <div className="px-6 pt-4 pb-2">
                <button onClick={onBack} className="flex items-center gap-1 text-nf-gray text-sm mb-3 hover:text-charcoal transition-colors">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                    Atrás
                </button>
                <h2 className="font-serif text-2xl font-semibold text-charcoal mb-1">Selecciona tu Profesional</h2>
                <p className="text-sm text-nf-gray">Elige con quién prefieres atenderte o selecciona cualquiera.</p>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
                {loading ? (
                    <div className="flex justify-center py-10">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink"></div>
                    </div>
                ) : (
                    <div className="space-y-3 stagger-children">
                        {/* Any Available Option */}
                        <button
                            onClick={() => onSelect({ id: 'any', name: 'Cualquier profesional', active: true } as Staff, true)}
                            className={`
                                w-full text-left p-4 rounded-2xl transition-all duration-200 border-2 flex items-center gap-4
                                ${selectedStaffId === 'any'
                                    ? 'border-pink bg-pink-pale shadow-md'
                                    : 'border-transparent bg-white shadow-sm hover:shadow-md hover:border-cream-dark'
                                }
                            `}
                        >
                            <div className={`w-12 h-12 rounded-full border-2 border-dashed flex items-center justify-center text-xl shadow-inner ${selectedStaffId === 'any' ? 'bg-white border-pink text-pink' : 'bg-gray-50 border-gray-300 text-gray-400'}`}>
                                💫
                            </div>
                            <div>
                                <h3 className="font-semibold text-charcoal text-[15px]">Cualquiera disponible</h3>
                                <p className="text-xs text-charcoal-light line-clamp-1 mt-0.5">La primera opción disponible.</p>
                            </div>
                        </button>

                        <div className="h-px bg-gray-200 my-4"></div>

                        {/* Specific Staff Options */}
                        {staffList.filter(s => s.active).map((staff) => {
                            const isSelected = selectedStaffId === staff.id;
                            return (
                                <button
                                    key={staff.id}
                                    onClick={() => onSelect(staff, false)}
                                    className={`
                                        w-full text-left p-4 rounded-2xl transition-all duration-200 border-2 flex items-center gap-4
                                        ${isSelected
                                            ? 'border-pink bg-pink-pale shadow-md'
                                            : 'border-transparent bg-white shadow-sm hover:shadow-md hover:border-cream-dark'
                                        }
                                    `}
                                >
                                    <img
                                        src={api.getPublicUrl(staff.photo_url) || `https://ui-avatars.com/api/?name=${encodeURIComponent(staff.name)}&background=random`}
                                        alt={staff.name}
                                        className="w-12 h-12 rounded-full object-cover border-2 bg-gray-100"
                                        style={{ borderColor: staff.color_identifier || '#E8B4B8' }}
                                    />
                                    <div>
                                        <h3 className="font-semibold text-charcoal text-[15px]">{staff.name}</h3>
                                        <p className="text-xs text-charcoal-light line-clamp-1 mt-0.5">{staff.bio}</p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="p-6 bg-white/50 backdrop-blur-md">
                <button
                    onClick={onNext}
                    disabled={!selectedStaffId}
                    className="btn-gradient w-full py-4 rounded-2xl text-base"
                >
                    Continuar
                </button>
            </div>
        </div>
    );
}
