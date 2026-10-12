"use client";
/* eslint-disable react-hooks/refs -- dnd-kit callback refs are the intended API. */

import { DndContext, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import type { FormBuilderConfig, FormFieldConfig, Lang } from "@/lib/content-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type FormDefinition = FormBuilderConfig["forms"][number];

function FieldCard({ field, steps, lang, onChange, onDelete }: { field: FormFieldConfig; steps: FormDefinition["steps"]; lang: Lang; onChange: (next: FormFieldConfig) => void; onDelete: () => void }) {
  const sortable = useSortable({ id: field.id });
  return <article ref={sortable.setNodeRef} style={{ transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition }} className={`rounded-xl border bg-background/80 p-3 ${sortable.isDragging ? "z-30 border-[var(--ai-1)] shadow-xl" : ""}`}>
    <div className="flex items-center gap-2"><button type="button" className="touch-none cursor-grab p-1" {...sortable.attributes} {...sortable.listeners}><GripVertical className="size-4"/></button><Input value={field.label} onChange={(event) => onChange({ ...field, label: event.target.value })} className="h-8 flex-1"/><Button type="button" size="icon" variant="ghost" className="text-destructive" onClick={onDelete}><Trash2 className="size-4"/></Button></div>
    <div className="mt-2 grid grid-cols-2 gap-2"><select value={field.type} onChange={(event) => onChange({ ...field, type: event.target.value as FormFieldConfig["type"] })} className="h-8 rounded-md border bg-background px-2 text-xs">{["text","email","textarea","select","checkbox","radio","number","tel","url"].map((type) => <option key={type}>{type}</option>)}</select><select value={field.stepId} onChange={(event) => onChange({ ...field, stepId: event.target.value })} className="h-8 rounded-md border bg-background px-2 text-xs">{steps.map((step) => <option key={step.id} value={step.id}>{step.title || step.id}</option>)}</select><Input value={field.placeholder} onChange={(event) => onChange({ ...field, placeholder: event.target.value })} placeholder={lang === "fa" ? "متن راهنما" : "Placeholder"} className="h-8 text-xs"/><select value={field.width} onChange={(event) => onChange({ ...field, width: event.target.value as "full" | "half" })} className="h-8 rounded-md border bg-background px-2 text-xs"><option value="full">100%</option><option value="half">50%</option></select></div>
    <label className="mt-2 flex items-center gap-2 text-xs"><input type="checkbox" checked={field.required} onChange={(event) => onChange({ ...field, required: event.target.checked })}/>{lang === "fa" ? "اجباری" : "Required"}</label>
  </article>;
}

export function CmsFormDesigner({ form, lang, onChange }: { form: FormDefinition; lang: Lang; onChange: (next: FormDefinition) => void }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }));
  const dragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return; const from = form.fields.findIndex((field) => field.id === active.id); const to = form.fields.findIndex((field) => field.id === over.id); if (from >= 0 && to >= 0) onChange({ ...form, fields: arrayMove(form.fields, from, to) });
  };
  const add = (type: FormFieldConfig["type"]) => {
    const id = `field-${Date.now()}`; onChange({ ...form, fields: [...form.fields, { id, label: type[0].toUpperCase() + type.slice(1), type, placeholder: "", required: false, options: [], width: "full", stepId: form.steps[0]?.id || "start", showWhenField: "", showWhenOperator: "filled", showWhenValue: "" }] });
  };
  return <div className="grid gap-4 lg:grid-cols-[180px_1fr_320px]">
    <aside className="rounded-xl border bg-background/50 p-3"><p className="mb-2 text-xs font-bold">{lang === "fa" ? "فیلد جدید" : "Add field"}</p>{(["text","email","textarea","select","checkbox","radio","number","tel","url"] as FormFieldConfig["type"][]).map((type) => <Button key={type} type="button" size="sm" variant="ghost" className="mb-1 w-full justify-start" onClick={() => add(type)}><Plus className="size-3"/>{type}</Button>)}</aside>
    <DndContext sensors={sensors} onDragEnd={dragEnd}><SortableContext items={form.fields.map((field) => field.id)} strategy={verticalListSortingStrategy}><div className="space-y-2">{form.fields.map((field) => <FieldCard key={field.id} field={field} steps={form.steps} lang={lang} onChange={(next) => onChange({ ...form, fields: form.fields.map((item) => item.id === field.id ? next : item) })} onDelete={() => onChange({ ...form, fields: form.fields.filter((item) => item.id !== field.id) })}/>)}</div></SortableContext></DndContext>
    <div className="rounded-xl border bg-background/50 p-4"><p className="text-xs font-bold">{form.title}</p><p className="mt-1 text-[10px] text-muted-foreground">{form.description}</p><div className="mt-4 grid grid-cols-2 gap-2">{form.fields.map((field) => <label key={field.id} className={`space-y-1 text-[10px] ${field.width === "full" ? "col-span-2" : ""}`}><span>{field.label}{field.required ? " *" : ""}</span>{field.type === "textarea" ? <textarea disabled className="h-16 w-full rounded border bg-background"/> : <input disabled className="h-8 w-full rounded border bg-background"/>}</label>)}</div><Button type="button" size="sm" className="mt-3 w-full" disabled>{form.steps.at(-1)?.submitLabel || "Submit"}</Button></div>
  </div>;
}
