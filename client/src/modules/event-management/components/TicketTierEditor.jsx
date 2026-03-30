import { useFieldArray } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import { HiPlus, HiTrash } from 'react-icons/hi';

export default function TicketTierEditor({ control, register, errors, capacityError = '', totalCapacity = 0, venueCapacity = 0 }) {
  const { fields, append, remove } = useFieldArray({ control, name: 'ticketTiers', keyName: 'fieldId' });

  return (
    <div className="neo-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading text-sm uppercase tracking-wider">Ticket Tiers</h2>
        <button
          type="button"
          onClick={() => append({ id: null, name: '', price: 0, capacity: 50, maxPerOrder: 10, currency: 'INR', description: '' })}
          className="neo-btn neo-btn-sm bg-neo-green"
        >
          <HiPlus /> Add Tier
        </button>
      </div>

      {errors?.ticketTiers?.message && (
        <p className="text-xs text-neo-red mb-3">{errors.ticketTiers.message}</p>
      )}
      {capacityError ? (
        <p className="text-xs text-neo-red mb-3">
          {capacityError} Current: {Number(totalCapacity || 0)} / {Number(venueCapacity || 0)}
        </p>
      ) : null}

      <AnimatePresence>
        {fields.map((field, i) => (
          <motion.div
            key={field.fieldId}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-3 border-neo-black/20 p-4 mb-3"
          >
            <input type="hidden" {...register(`ticketTiers.${i}.id`)} />
            <div className="flex justify-between items-center mb-3">
              <span className="neo-badge bg-neo-lavender">Tier {i + 1}</span>
              {fields.length > 1 && (
                <button type="button" onClick={() => remove(i)} className="text-neo-red">
                  <HiTrash />
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="col-span-2">
                <label htmlFor={`ticket-tier-name-${i}`} className="neo-label mb-1">Tier Name</label>
                <input
                  id={`ticket-tier-name-${i}`}
                  {...register(`ticketTiers.${i}.name`, { required: true })}
                  className="neo-input"
                  placeholder="Tier name (e.g. VIP)"
                />
              </div>
              <div>
                <label htmlFor={`ticket-tier-price-${i}`} className="neo-label mb-1">Price</label>
                <input
                  id={`ticket-tier-price-${i}`}
                  type="number"
                  {...register(`ticketTiers.${i}.price`, { valueAsNumber: true, min: 0 })}
                  className="neo-input"
                  placeholder="Price"
                />
                <p className="mt-1 text-[11px] text-neo-black/65">
                  Paid checkout via Polar fails for INR prices below 60.
                </p>
              </div>
              <div>
                <label htmlFor={`ticket-tier-capacity-${i}`} className="neo-label mb-1">Capacity</label>
                <input
                  id={`ticket-tier-capacity-${i}`}
                  type="number"
                  {...register(`ticketTiers.${i}.capacity`, { valueAsNumber: true, min: 1 })}
                  className="neo-input"
                  placeholder="Capacity"
                />
              </div>
              <div>
                <label htmlFor={`ticket-tier-max-order-${i}`} className="neo-label mb-1">Max / Person</label>
                <input
                  id={`ticket-tier-max-order-${i}`}
                  type="number"
                  {...register(`ticketTiers.${i}.maxPerOrder`, { valueAsNumber: true, min: 1 })}
                  className="neo-input"
                  placeholder="10"
                />
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
