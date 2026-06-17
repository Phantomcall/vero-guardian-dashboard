'use client';

import React, { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { SortableWidget } from './SortableWidget';

export interface Widget {
  id: string;
  component: React.ReactNode;
  className?: string;
}

interface WidgetGridProps {
  widgets: Widget[];
  storageKey?: string;
}

export function WidgetGrid({ widgets, storageKey = 'vero-dashboard-layout' }: WidgetGridProps) {
  const [activeLayout, setActiveLayout] = useState<string[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  const widgetIdsStr = widgets.map(w => w.id).join(',');

  useEffect(() => {
    setIsMounted(true);
    const savedLayout = localStorage.getItem(storageKey);
    const validIds = widgetIdsStr.split(',').filter(Boolean);
    
    if (savedLayout) {
      try {
        const parsed = JSON.parse(savedLayout);
        const filtered = parsed.filter((id: string) => validIds.includes(id));
        const missingIds = validIds.filter(id => !filtered.includes(id));
        setActiveLayout([...filtered, ...missingIds]);
      } catch (e) {
        setActiveLayout(validIds);
      }
    } else {
      setActiveLayout(validIds);
    }
  }, [widgetIdsStr, storageKey]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setActiveLayout((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        const newLayout = arrayMove(items, oldIndex, newIndex);
        localStorage.setItem(storageKey, JSON.stringify(newLayout));
        return newLayout;
      });
    }
  }

  if (!isMounted) {
    // Return the grid without drag-and-drop support before hydration
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {widgets.map(widget => (
          <div key={widget.id} className={widget.className}>
            <div className="h-full">
              {widget.component}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={activeLayout}
        strategy={rectSortingStrategy}
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {activeLayout.map(id => {
            const widget = widgets.find(w => w.id === id);
            if (!widget) return null;
            return (
              <SortableWidget key={widget.id} id={widget.id} className={widget.className}>
                {widget.component}
              </SortableWidget>
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}
