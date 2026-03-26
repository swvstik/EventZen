import { useFieldArray } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import { HiPlus, HiTrash } from 'react-icons/hi';

export default function ScheduleEditor({ control, register }) {
  const { fields, append, remove } = useFieldArray({ control, name: 'scheduleSlots' });

  return (
    <div className="neo-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading text-sm uppercase tracking-wider">Schedule</h2>
        <button
          type="button"
          onClick={() =>
            append({ sessionTitle: '', startTime: '', endTime: '', speakerName: '', locationNote: '' })
          }
          className="neo-btn neo-btn-sm bg-neo-blue text-white"
        >
          <HiPlus /> Add Slot
        </button>
      </div>

      <AnimatePresence>
        {fields.map((field, i) => (
          <motion.div
            key={field.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="border-3 border-neo-black/20 p-4 mb-3"
          >
            <div className="flex justify-between items-center mb-3">
              <span className="neo-badge bg-neo-peach">Slot {i + 1}</span>
              <button type="button" onClick={() => remove(i)} className="text-neo-red">
                <HiTrash />
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="col-span-2">
                <label htmlFor={`schedule-slot-title-${i}`} className="sr-only">Session Title</label>
                <input
                  id={`schedule-slot-title-${i}`}
                  {...register(`scheduleSlots.${i}.sessionTitle`)}
                  className="neo-input"
                  placeholder="Session title"
                />
              </div>
              <label htmlFor={`schedule-slot-start-${i}`} className="sr-only">Start Time</label>
              <input
                id={`schedule-slot-start-${i}`}
                type="time"
                {...register(`scheduleSlots.${i}.startTime`)}
                className="neo-input"
              />
              <label htmlFor={`schedule-slot-end-${i}`} className="sr-only">End Time</label>
              <input
                id={`schedule-slot-end-${i}`}
                type="time"
                {...register(`scheduleSlots.${i}.endTime`)}
                className="neo-input"
              />
              <div className="col-span-2">
                <label htmlFor={`schedule-slot-speaker-${i}`} className="sr-only">Speaker Name</label>
                <input
                  id={`schedule-slot-speaker-${i}`}
                  {...register(`scheduleSlots.${i}.speakerName`)}
                  className="neo-input"
                  placeholder="Speaker name"
                />
              </div>
              <div className="col-span-2">
                <label htmlFor={`schedule-slot-location-${i}`} className="sr-only">Location</label>
                <input
                  id={`schedule-slot-location-${i}`}
                  {...register(`scheduleSlots.${i}.locationNote`)}
                  className="neo-input"
                  placeholder="Room / location"
                />
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
